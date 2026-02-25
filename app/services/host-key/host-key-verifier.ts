// app/services/host-key/host-key-verifier.ts
// Factory for SSH2 hostVerifier callback

import type { Socket } from 'socket.io'
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
 * Create a hostVerifier callback for SSH2's Client.connect().
 *
 * Decision tree:
 * 1. Feature disabled -> return true
 * 2. Server store lookup:
 *    - trusted -> emit verified, return true
 *    - mismatch -> emit mismatch, return false
 *    - unknown -> fall through
 * 3. Client store enabled -> emit verify, await client response
 *    - trusted/accept -> emit verified, return true
 *    - reject -> return false
 *    - timeout -> return false
 * 4. Neither store has key -> apply unknownKeyAction:
 *    - alert -> emit alert, return true
 *    - reject -> emit rejected, return false
 *    - prompt -> emit verify, await client response
 */
export function createHostKeyVerifier(
  options: CreateHostKeyVerifierOptions
): (key: Buffer, info: { hostType: string }) => Promise<boolean> {
  const {
    hostKeyService,
    socket,
    host,
    port,
    log,
    timeout = DEFAULT_TIMEOUT,
  } = options

  return async (key: Buffer, info: { hostType: string }): Promise<boolean> => {
    // Step 1: Feature disabled
    if (!hostKeyService.isEnabled) {
      return true
    }

    const algorithm = info.hostType
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
        return true
      }

      if (lookupResult.status === 'mismatch') {
        log('Host key MISMATCH detected by server store')
        const storedFingerprint = lookupResult.storedKey !== undefined
          ? HostKeyService.computeFingerprint(lookupResult.storedKey)
          : 'unknown'
        const payload: HostKeyMismatchPayload = {
          host,
          port,
          algorithm,
          presentedFingerprint: fingerprint,
          storedFingerprint,
          source: 'server',
        }
        socket.emit(SOCKET_EVENTS.HOSTKEY_MISMATCH, payload)
        return false
      }

      // status === 'unknown', fall through
      log('Host key unknown in server store, checking client store')
    }

    // Step 3: Client store lookup
    if (hostKeyService.clientStoreEnabled) {
      return awaitClientVerification(
        socket, host, port, algorithm, base64Key, fingerprint, 'client', log, timeout
      )
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
      return true
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
      return false
    }

    // action === 'prompt'
    log('Unknown key action: prompt')
    return awaitClientVerification(
      socket, host, port, algorithm, base64Key, fingerprint, 'prompt', log, timeout
    )
  }
}

/**
 * Emit a verify event to the client and wait for their response
 * with a configurable timeout.
 */
function awaitClientVerification(
  socket: Socket,
  host: string,
  port: number,
  algorithm: string,
  base64Key: string,
  fingerprint: string,
  source: 'client' | 'prompt',
  log: (...args: unknown[]) => void,
  timeout: number
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const verifyPayload: HostKeyVerifyPayload = {
      host,
      port,
      algorithm,
      fingerprint,
      key: base64Key,
    }

    const handler = (response: HostKeyVerifyResponse): void => {
      clearTimeout(timer)

      if (response.action === 'accept' || response.action === 'trusted') {
        log('Client accepted host key')
        const verifiedPayload: HostKeyVerifiedPayload = {
          host,
          port,
          algorithm,
          fingerprint,
          source: 'client',
        }
        socket.emit(SOCKET_EVENTS.HOSTKEY_VERIFIED, verifiedPayload)
        resolve(true)
        return
      }

      // action === 'reject'
      log('Client rejected host key')
      resolve(false)
    }

    const timer = setTimeout(() => {
      log('Host key verification timed out')
      socket.removeListener(SOCKET_EVENTS.HOSTKEY_VERIFY_RESPONSE, handler)
      resolve(false)
    }, timeout)

    socket.once(SOCKET_EVENTS.HOSTKEY_VERIFY_RESPONSE, handler)
    socket.emit(SOCKET_EVENTS.HOSTKEY_VERIFY, verifyPayload)
  })
}
