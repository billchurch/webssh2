// tests/unit/socket-v2-test-utils.ts
// Shared test utilities for socket-v2 tests

import { vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { MOCK_CREDENTIALS } from '../test-constants.js'

/**
 * Sets up an authenticated socket for testing
 */
export const setupAuthenticatedSocket = async (io: any, mockSocket: any) => {
  const onConn = (io.on as any).mock.calls[0][1]
  mockSocket.request.session.usedBasicAuth = true
  mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
  onConn(mockSocket)

  // Wait for authentication
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
}

/**
 * Tracks events emitted by the socket
 */
export const trackEmittedEvents = (mockSocket: any) => {
  const emittedEvents: Array<{ event: string; payload?: any }> = []
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
export const waitForAsync = async (iterations = 1) => {
  for (let i = 0; i < iterations; i++) {
    await new Promise((r) => setImmediate(r))
  }
}

/**
 * Creates a mock socket for testing
 */
export const createMockSocket = (id = 'test-socket-id') => {
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
 * Creates a mock IO instance for testing
 */
export const createMockIO = () => {
  const io = new EventEmitter() as any
  io.on = vi.fn(io.on.bind(io))
  return io
}

/**
 * Creates default mock config for testing
 */
export const createMockConfig = () => ({
  ssh: { term: 'xterm-color', disableInteractiveAuth: false },
  options: { allowReauth: true, allowReplay: true, allowReconnect: true },
  user: {},
  header: null
})

/**
 * Filters events by type from the emitted events array
 */
export const filterEventsByType = (events: Array<{ event: string; payload?: any }>, eventType: string) => {
  return events.filter(e => e.event === eventType)
}

/**
 * Emits an event on the mock socket and waits for processing
 */
export const emitSocketEvent = async (mockSocket: any, event: string, payload: any = {}, waitIterations = 1) => {
  EventEmitter.prototype.emit.call(mockSocket, event, payload)
  await waitForAsync(waitIterations)
}

/**
 * Sets up an authenticated socket with event tracking
 */
export const setupAuthenticatedSocketWithTracking = async (io: any, mockSocket: any) => {
  await setupAuthenticatedSocket(io, mockSocket)
  return trackEmittedEvents(mockSocket)
}

/**
 * Creates a terminal session on the mock socket
 */
export const createTerminalSession = async (mockSocket: any) => {
  await emitSocketEvent(mockSocket, 'terminal', {})
}