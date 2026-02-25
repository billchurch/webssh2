// tests/unit/services/host-key/host-key-verifier.vitest.ts
// Tests for createHostKeyVerifier factory

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createHostKeyVerifier,
  extractAlgorithm,
} from '../../../../app/services/host-key/host-key-verifier.js'
import { HostKeyService } from '../../../../app/services/host-key/host-key-service.js'
import { SOCKET_EVENTS } from '../../../../app/constants/socket-events.js'

// --- Mock helpers ---

interface MockSocket {
  emit: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
}

function createMockSocket(): MockSocket {
  return {
    emit: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  }
}

function createMockHostKeyService(overrides: {
  isEnabled?: boolean
  serverStoreEnabled?: boolean
  clientStoreEnabled?: boolean
  unknownKeyAction?: 'prompt' | 'alert' | 'reject'
  serverLookupResult?: { status: 'trusted' | 'mismatch' | 'unknown'; storedKey?: string }
}): HostKeyService {
  const service = {
    get isEnabled() { return overrides.isEnabled ?? true },
    get serverStoreEnabled() { return overrides.serverStoreEnabled ?? false },
    get clientStoreEnabled() { return overrides.clientStoreEnabled ?? false },
    get unknownKeyAction() { return overrides.unknownKeyAction ?? 'prompt' },
    serverLookup: vi.fn().mockReturnValue(overrides.serverLookupResult ?? { status: 'unknown' }),
    close: vi.fn(),
  }
  return service as unknown as HostKeyService
}

/**
 * Helper: invoke the verifier and return a promise that resolves
 * when the verify callback is called.
 */
function callVerifier(
  verifier: (key: Buffer, verify: (valid: boolean) => void) => void,
  keyBuffer: Buffer
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    verifier(keyBuffer, (valid: boolean) => {
      resolve(valid)
    })
  })
}

// Base64 key and algorithm for testing
const TEST_BASE64_KEY = 'AAAAC3NzaC1lZDI1NTE5AAAAIHVKcNtf2JfGHbMHOiT6VNBBpJIxMZpL'
const TEST_KEY_BUFFER = Buffer.from(TEST_BASE64_KEY, 'base64')
const TEST_HOST = 'server1.example.com'
const TEST_PORT = 22
const TEST_FINGERPRINT = HostKeyService.computeFingerprint(TEST_BASE64_KEY)
const STORED_KEY = 'AAAAB3NzaC1yc2EAAAADAQABAAABgQC7lPe5xp0h'
const STORED_FINGERPRINT = HostKeyService.computeFingerprint(STORED_KEY)

function mockLog(..._args: unknown[]): void {
  // no-op for tests
}

describe('extractAlgorithm', () => {
  it('extracts ssh-ed25519 from a key buffer', () => {
    expect(extractAlgorithm(TEST_KEY_BUFFER)).toBe('ssh-ed25519')
  })

  it('returns unknown for a buffer that is too short', () => {
    expect(extractAlgorithm(Buffer.alloc(2))).toBe('unknown')
  })

  it('returns unknown when length field exceeds buffer', () => {
    const buf = Buffer.alloc(8)
    buf.writeUInt32BE(100, 0) // claims 100 bytes but only 4 follow
    expect(extractAlgorithm(buf)).toBe('unknown')
  })
})

describe('createHostKeyVerifier', () => {
  let socket: MockSocket

  beforeEach(() => {
    socket = createMockSocket()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true without events when feature is disabled', async () => {
    const service = createMockHostKeyService({ isEnabled: false })
    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, TEST_KEY_BUFFER)

    expect(result).toBe(true)
    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('returns true and emits verified when server store reports trusted', async () => {
    const service = createMockHostKeyService({
      isEnabled: true,
      serverStoreEnabled: true,
      serverLookupResult: { status: 'trusted', storedKey: TEST_BASE64_KEY },
    })
    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, TEST_KEY_BUFFER)

    expect(result).toBe(true)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_VERIFIED,
      expect.objectContaining({ source: 'server' })
    )
  })

  it('returns false and emits mismatch when server store reports mismatch', async () => {
    const service = createMockHostKeyService({
      isEnabled: true,
      serverStoreEnabled: true,
      serverLookupResult: { status: 'mismatch', storedKey: STORED_KEY },
    })
    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, TEST_KEY_BUFFER)

    expect(result).toBe(false)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_MISMATCH,
      expect.objectContaining({
        source: 'server',
        presentedFingerprint: TEST_FINGERPRINT,
        storedFingerprint: STORED_FINGERPRINT,
      })
    )
  })

  it('returns true when server unknown and client accepts', async () => {
    const service = createMockHostKeyService({
      isEnabled: true,
      serverStoreEnabled: true,
      clientStoreEnabled: true,
      serverLookupResult: { status: 'unknown' },
    })

    // Simulate client responding 'accept'
    socket.once.mockImplementation((_event: string, handler: (response: { action: string }) => void) => {
      setTimeout(() => {
        handler({ action: 'accept' })
      }, 10)
    })

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const promise = callVerifier(verifier, TEST_KEY_BUFFER)

    // Advance timer to trigger the client response
    await vi.advanceTimersByTimeAsync(10)

    const result = await promise

    expect(result).toBe(true)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_VERIFY,
      expect.objectContaining({
        host: TEST_HOST,
        port: TEST_PORT,
        algorithm: 'ssh-ed25519',
        fingerprint: TEST_FINGERPRINT,
      })
    )
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_VERIFIED,
      expect.objectContaining({ source: 'client' })
    )
  })

  it('returns false when server unknown and client rejects', async () => {
    const service = createMockHostKeyService({
      isEnabled: true,
      serverStoreEnabled: true,
      clientStoreEnabled: true,
      serverLookupResult: { status: 'unknown' },
    })

    socket.once.mockImplementation((_event: string, handler: (response: { action: string }) => void) => {
      setTimeout(() => {
        handler({ action: 'reject' })
      }, 10)
    })

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const promise = callVerifier(verifier, TEST_KEY_BUFFER)
    await vi.advanceTimersByTimeAsync(10)
    const result = await promise

    expect(result).toBe(false)
  })

  it('returns false when client response times out', async () => {
    const service = createMockHostKeyService({
      isEnabled: true,
      serverStoreEnabled: false,
      clientStoreEnabled: true,
    })

    // Do not respond — let it timeout
    socket.once.mockImplementation(() => {
      // intentionally empty: simulates no client response
    })

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
      timeout: 5000,
    })

    const promise = callVerifier(verifier, TEST_KEY_BUFFER)

    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(5001)

    const result = await promise

    expect(result).toBe(false)
    expect(socket.removeListener).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_VERIFY_RESPONSE,
      expect.any(Function)
    )
  })

  it('returns false and emits rejected when neither store has key and action is reject', async () => {
    const service = createMockHostKeyService({
      isEnabled: true,
      serverStoreEnabled: false,
      clientStoreEnabled: false,
      unknownKeyAction: 'reject',
    })

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, TEST_KEY_BUFFER)

    expect(result).toBe(false)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_REJECTED,
      expect.objectContaining({
        host: TEST_HOST,
        port: TEST_PORT,
      })
    )
  })

  it('returns true and emits alert when neither store has key and action is alert', async () => {
    const service = createMockHostKeyService({
      isEnabled: true,
      serverStoreEnabled: false,
      clientStoreEnabled: false,
      unknownKeyAction: 'alert',
    })

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, TEST_KEY_BUFFER)

    expect(result).toBe(true)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_ALERT,
      expect.objectContaining({
        host: TEST_HOST,
        port: TEST_PORT,
        fingerprint: TEST_FINGERPRINT,
      })
    )
  })

  it('prompts client when neither store has key and action is prompt', async () => {
    const service = createMockHostKeyService({
      isEnabled: true,
      serverStoreEnabled: false,
      clientStoreEnabled: false,
      unknownKeyAction: 'prompt',
    })

    socket.once.mockImplementation((_event: string, handler: (response: { action: string }) => void) => {
      setTimeout(() => {
        handler({ action: 'accept' })
      }, 10)
    })

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const promise = callVerifier(verifier, TEST_KEY_BUFFER)
    await vi.advanceTimersByTimeAsync(10)
    const result = await promise

    expect(result).toBe(true)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_VERIFY,
      expect.objectContaining({
        host: TEST_HOST,
        port: TEST_PORT,
      })
    )
  })
})
