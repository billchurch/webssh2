// tests/unit/socket-v2-test-utils.ts
// Shared test utilities for socket-v2 tests - Vitest specific

import { vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { MOCK_CREDENTIALS } from '../test-constants.js'
import { DEFAULTS } from '../../app/constants.js'

// Re-export common utilities from main test-utils
export {
  createMockSocket as createBaseMockSocket,
  createMockIO as createBaseMockIO,
  createMockSocketConfig
} from '../test-utils.js'

/**
 * Sets up an authenticated socket for testing (Vitest version)
 */
export const setupAuthenticatedSocket = async (io: unknown, mockSocket: unknown): Promise<void> => {
  const onConn = (io.on).mock.calls[0][1]
  mockSocket.request.session.usedBasicAuth = true
  mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
  onConn(mockSocket)

  // Wait for authentication
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
}

/**
 * Tracks events emitted by the socket (Vitest version)
 */
export const trackEmittedEvents = (mockSocket: unknown): Array<{ event: string; payload?: unknown }> => {
  const emittedEvents: Array<{ event: string; payload?: unknown }> = []
  const originalEmit = mockSocket.emit
  mockSocket.emit = vi.fn((...args) => {
    emittedEvents.push({ event: args[0], payload: args[1] })
    return originalEmit.apply(mockSocket, args)
  })
  return emittedEvents
}

/**
 * Waits for async operations to complete
 */
export const waitForAsync = async (iterations = 1): Promise<void> => {
  for (let i = 0; i < iterations; i++) {
    await new Promise((r) => setImmediate(r))
  }
}

/**
 * Creates a mock socket for Vitest testing
 */
export const createMockSocket = (id = 'test-socket-id'): unknown => {
  const mockSocket = new EventEmitter() as any
  mockSocket.id = id
  mockSocket.request = {
    session: {
      save: vi.fn((cb: () => void) => cb()),
      sshCredentials: null,
      usedBasicAuth: false,
      envVars: null
    }
  }
  mockSocket.emit = vi.fn()
  mockSocket.disconnect = vi.fn()
  return mockSocket
}

/**
 * Creates a mock IO instance for Vitest testing
 */
export const createMockIO = (): unknown => {
  const io = new EventEmitter() as any
  io.on = vi.fn(io.on.bind(io))
  return io
}

/**
 * Creates default mock config for testing
 */
export const createMockConfig = (): { ssh: unknown; options: unknown; user: unknown; header: null } => ({
  ssh: {
    term: DEFAULTS.SSH_TERM,
    disableInteractiveAuth: false,
    readyTimeout: DEFAULTS.SSH_READY_TIMEOUT_MS,
    keepaliveInterval: DEFAULTS.SSH_KEEPALIVE_INTERVAL_MS,
    keepaliveCountMax: DEFAULTS.SSH_KEEPALIVE_COUNT_MAX
  },
  options: {
    allowReauth: true,
    allowReplay: true,
    allowReconnect: true
  },
  user: {},
  header: null
})

/**
 * Filters events by type from the emitted events array
 */
export const filterEventsByType = (events: Array<{ event: string; payload?: unknown }>, eventType: string): Array<{ event: string; payload?: unknown }> => {
  return events.filter(e => e.event === eventType)
}

/**
 * Emits an event on the mock socket and waits for processing
 */
export const emitSocketEvent = async (mockSocket: unknown, event: string, payload: unknown = {}, waitIterations = 1): Promise<void> => {
  EventEmitter.prototype.emit.call(mockSocket, event, payload)
  await waitForAsync(waitIterations)
}

/**
 * Sets up an authenticated socket with event tracking
 */
export const setupAuthenticatedSocketWithTracking = async (io: unknown, mockSocket: unknown): Promise<Array<{ event: string; payload?: unknown }>> => {
  await setupAuthenticatedSocket(io, mockSocket)
  return trackEmittedEvents(mockSocket)
}

/**
 * Creates a terminal session on the mock socket
 */
export const createTerminalSession = async (mockSocket: unknown): Promise<void> => {
  await emitSocketEvent(mockSocket, 'terminal', {})
}