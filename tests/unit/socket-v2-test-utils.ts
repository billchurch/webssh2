// tests/unit/socket-v2-test-utils.ts
// Shared test utilities for socket-v2 tests - Vitest specific

import { vi, type Mock } from 'vitest'
import { EventEmitter } from 'node:events'
import { MOCK_CREDENTIALS } from '../test-constants.js'
import { DEFAULTS } from '../../app/constants.js'

// Type definitions for mock objects
interface MockSession {
  save: Mock
  sshCredentials: unknown
  usedBasicAuth: boolean
  envVars: unknown
}

interface MockRequest {
  session: MockSession
}

interface MockSocket extends EventEmitter {
  id: string
  request: MockRequest
  emit: Mock
  disconnect: Mock
}

interface MockIO extends EventEmitter {
  on: Mock
}

interface MockConfig {
  ssh: {
    term: string
    disableInteractiveAuth: boolean
    readyTimeout: number
    keepaliveInterval: number
    keepaliveCountMax: number
  }
  options: {
    allowReauth: boolean
    allowReplay: boolean
    allowReconnect: boolean
  }
  user: Record<string, unknown>
  header: null
}

// Re-export common utilities from main test-utils
export {
  createMockSocket as createBaseMockSocket,
  createMockIO as createBaseMockIO,
  createMockSocketConfig
} from '../test-utils.js'

/**
 * Sets up an authenticated socket for testing (Vitest version)
 */
export const setupAuthenticatedSocket = async (io: MockIO, mockSocket: MockSocket): Promise<void> => {
  const mockCalls = (io.on).mock.calls
  if (mockCalls.length === 0) {
    throw new Error('No mock calls found on io.on')
  }
  const onConn = mockCalls[0][1] as (socket: MockSocket) => void
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
export const trackEmittedEvents = (mockSocket: MockSocket): Array<{ event: string; payload?: unknown }> => {
  const emittedEvents: Array<{ event: string; payload?: unknown }> = []
  const originalEmit = mockSocket.emit
  mockSocket.emit = vi.fn((...args: unknown[]) => {
    emittedEvents.push({ event: args[0] as string, payload: args[1] })
    return originalEmit(...args) as unknown
  }) as Mock
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
export const createMockSocket = (id = 'test-socket-id'): MockSocket => {
  const mockSocket = new EventEmitter() as MockSocket
  mockSocket.id = id
  mockSocket.request = {
    session: {
      save: vi.fn((cb: () => void) => cb()) as Mock,
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
export const createMockIO = (): MockIO => {
  const io = new EventEmitter() as MockIO
  const originalOn = io.on.bind(io)
  io.on = vi.fn(originalOn) as Mock
  return io
}

/**
 * Creates default mock config for testing
 */
export const createMockConfig = (): MockConfig => ({
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
export const emitSocketEvent = async (mockSocket: MockSocket, event: string, payload: unknown = {}, waitIterations = 1): Promise<void> => {
  EventEmitter.prototype.emit.call(mockSocket, event, payload)
  await waitForAsync(waitIterations)
}

/**
 * Sets up an authenticated socket with event tracking
 */
export const setupAuthenticatedSocketWithTracking = async (io: MockIO, mockSocket: MockSocket): Promise<Array<{ event: string; payload?: unknown }>> => {
  await setupAuthenticatedSocket(io, mockSocket)
  return trackEmittedEvents(mockSocket)
}

/**
 * Creates a terminal session on the mock socket
 */
export const createTerminalSession = async (mockSocket: MockSocket): Promise<void> => {
  await emitSocketEvent(mockSocket, 'terminal', {})
}