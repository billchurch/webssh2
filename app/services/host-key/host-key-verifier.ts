// app/services/host-key/host-key-verifier.ts
// Factory for SSH2 hostVerifier callback

import type { Socket } from 'socket.io'
import type { HostVerifier } from 'ssh2'
import { HostKeyService } from './host-key-service.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'

/**
 * Options for creating a host key verifier callback
 */
export interface CreateHostKeyVerifierOptions {
  hostKeyService: HostKeyService
  socket: Socket
  host: string
  port: number
  log: (...args: unknown[]) => void
  timeout?: number
}

/**
 * Payload emitted with hostkey:verify to prompt the client
 */
interface HostKeyVerifyPayload {
  host: string
  port: number
  algorithm: string
  fingerprint: string
  key: string
}

/**
 * Payload emitted with hostkey:verified on success
 */
interface HostKeyVerifiedPayload {
  host: string
  port: number
  algorithm: string
  fingerprint: string
  source: 'server' | 'client'
}

/**
 * Payload emitted with hostkey:mismatch on key mismatch
 */
interface HostKeyMismatchPayload {
  host: string
  port: number
  algorithm: string
  presentedFingerprint: string
  storedFingerprint: string
  source: 'server' | 'client'
}

/**
 * Payload emitted with hostkey:alert for unknown key alerts
 */
interface HostKeyAlertPayload {
  host: string
  port: number
  algorithm: string
  fingerprint: string
}

/**
 * Payload emitted with hostkey:rejected when key is rejected
 */
interface HostKeyRejectedPayload {
  host: string
  port: number
  algorithm: string
  fingerprint: string
}

/**
 * Client response to a host key verification prompt
 */
interface HostKeyVerifyResponse {
  action: 'accept' | 'reject' | 'trusted'
}

const DEFAULT_TIMEOUT = 30000

/**
 * Extract the algorithm name from an SSH public key buffer.
 *
 * SSH public key wire format: 4-byte big-endian length + algorithm string + key data.
 * Returns 'unknown' if the buffer is too short to parse.
 */
export function extractAlgorithm(keyBuffer: Buffer): string {
  if (keyBuffer.length < 4) {
    return 'unknown'
  }
  const algLength = keyBuffer.readUInt32BE(0)
  if (keyBuffer.length < 4 + algLength) {
    return 'unknown'
  }
  return keyBuffer.subarray(4, 4 + algLength).toString('ascii')
}

/**
 * Create a hostVerifier callback for SSH2 Client.connect().
 *
 * Decision tree:
 * 1. Feature disabled -> verify(true)
 * 2. Server store lookup:
 *    - trusted -> emit verified, verify(true)
 *    - mismatch -> emit mismatch, verify(false)
 *    - unknown -> fall through
 * 3. Client store enabled -> emit verify, await client response
 *    - trusted/accept -> emit verified, verify(true)
 *    - reject -> verify(false)
 *    - timeout -> verify(false)
 * 4. Neither store has key -> apply unknownKeyAction:
 *    - alert -> emit alert, verify(true)
 *    - reject -> emit rejected, verify(false)
 *    - prompt -> emit verify, await client response
 */
export function createHostKeyVerifier(
  options: CreateHostKeyVerifierOptions
): HostVerifier {
  const {
    hostKeyService,
    socket,
    host,
    port,
    log,
    timeout = DEFAULT_TIMEOUT,
  } = options

  return (key: Buffer, verify: (valid: boolean) => void): void => {
    // Step 1: Feature disabled
    if (!hostKeyService.isEnabled) {
      verify(true)
      return
    }

    const algorithm = extractAlgorithm(key)
    const base64Key = key.toString('base64')
    const fingerprint = HostKeyService.computeFingerprint(base64Key)

    log('Host key verification for', host, port, algorithm, fingerprint)

    // Step 2: Server store lookup
    if (hostKeyService.serverStoreEnabled) {
      const lookupResult = hostKeyService.serverLookup(host, port, algorithm, base64Key)

      if (lookupResult.status === 'trusted') {
        log('Host key trusted by server store')
        const payload: HostKeyVerifiedPayload = {
          host,
          port,
          algorithm,
          fingerprint,
          source: 'server',
        }
        socket.emit(SOCKET_EVENTS.HOSTKEY_VERIFIED, payload)
        verify(true)
        return
      }

      if (lookupResult.status === 'mismatch') {
        log('Host key MISMATCH detected by server store')
        const storedFingerprint = lookupResult.storedKey === undefined
          ? 'unknown'
          : HostKeyService.computeFingerprint(lookupResult.storedKey)
        const payload: HostKeyMismatchPayload = {
          host,
          port,
          algorithm,
          presentedFingerprint: fingerprint,
          storedFingerprint,
          source: 'server',
        }
        socket.emit(SOCKET_EVENTS.HOSTKEY_MISMATCH, payload)
        verify(false)
        return
      }

      // status === 'unknown', fall through
      log('Host key unknown in server store, checking client store')
    }

    // Step 3: Client store lookup
    if (hostKeyService.clientStoreEnabled) {
      awaitClientVerification({
        socket, host, port, algorithm, base64Key, fingerprint, log, timeout, verify,
      })
      return
    }

    // Step 4: Neither store has key -> apply unknownKeyAction
    const action = hostKeyService.unknownKeyAction

    if (action === 'alert') {
      log('Unknown key action: alert')
      const payload: HostKeyAlertPayload = {
        host,
        port,
        algorithm,
        fingerprint,
      }
      socket.emit(SOCKET_EVENTS.HOSTKEY_ALERT, payload)
      verify(true)
      return
    }

    if (action === 'reject') {
      log('Unknown key action: reject')
      const payload: HostKeyRejectedPayload = {
        host,
        port,
        algorithm,
        fingerprint,
      }
      socket.emit(SOCKET_EVENTS.HOSTKEY_REJECTED, payload)
      verify(false)
      return
    }

    // action === 'prompt'
    log('Unknown key action: prompt')
    awaitClientVerification({
      socket, host, port, algorithm, base64Key, fingerprint, log, timeout, verify,
    })
  }
}

interface ClientVerificationOptions {
  socket: Socket
  host: string
  port: number
  algorithm: string
  base64Key: string
  fingerprint: string
  log: (...args: unknown[]) => void
  timeout: number
  verify: (valid: boolean) => void
}

/**
 * Emit a verify event to the client and wait for their response
 * with a configurable timeout.
 */
function awaitClientVerification(options: ClientVerificationOptions): void {
  const { socket, host, port, algorithm, base64Key, fingerprint, log, timeout, verify } = options
  const verifyPayload: HostKeyVerifyPayload = {
    host,
    port,
    algorithm,
    fingerprint,
    key: base64Key,
  }

  const cleanup = (): void => {
    clearTimeout(timer)
    socket.removeListener(SOCKET_EVENTS.HOSTKEY_VERIFY_RESPONSE, handler)
    socket.removeListener('disconnect', onDisconnect)
  }

  const handler = (response: unknown): void => {
    cleanup()

    // Validate untrusted client payload
    if (
      typeof response !== 'object' ||
      response === null ||
      !('action' in response) ||
      typeof (response as HostKeyVerifyResponse).action !== 'string'
    ) {
      log('Invalid host key verify response, treating as reject')
      verify(false)
      return
    }

    const action = (response as HostKeyVerifyResponse).action

    if (action === 'accept' || action === 'trusted') {
      log('Client accepted host key')
      const verifiedPayload: HostKeyVerifiedPayload = {
        host,
        port,
        algorithm,
        fingerprint,
        source: 'client',
      }
      socket.emit(SOCKET_EVENTS.HOSTKEY_VERIFIED, verifiedPayload)
      verify(true)
      return
    }

    // action === 'reject' or unrecognized
    log('Client rejected host key')
    verify(false)
  }

  const onDisconnect = (): void => {
    log('Client disconnected during host key verification')
    cleanup()
    verify(false)
  }

  const timer = setTimeout(() => {
    log('Host key verification timed out')
    socket.removeListener(SOCKET_EVENTS.HOSTKEY_VERIFY_RESPONSE, handler)
    socket.removeListener('disconnect', onDisconnect)
    verify(false)
  }, timeout)

  socket.once(SOCKET_EVENTS.HOSTKEY_VERIFY_RESPONSE, handler)
  socket.once('disconnect', onDisconnect)
  socket.emit(SOCKET_EVENTS.HOSTKEY_VERIFY, verifyPayload)
}
