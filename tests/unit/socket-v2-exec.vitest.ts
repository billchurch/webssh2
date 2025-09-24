// tests/unit/socket-v2-exec.test.ts
// Vitest rewrite of socket exec functionality test

import { describe, it, beforeEach, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket-v2.js'
import {
  createMockIO,
  createMockSocket,
  createMockSSHConnection,
  createMockSocketConfig
} from '../test-utils.js'
import { TEST_PASSWORDS } from '../test-constants.js'

describe('Socket V2 Exec Handler', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket()
    mockConfig = createMockSocketConfig()
    MockSSHConnection = createMockSSHConnection({ withExecMethods: true })

    // Initialize socket handler
    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('should handle exec requests and emit typed output and exit', async () => {
    const connectionHandler = (io.on as any).mock.calls[0].arguments[1]

    // Configure session to auto-authenticate on connect
    mockSocket = createMockSocket({
      usedBasicAuth: true,
      sessionCredentials: {
        host: 'localhost',
        port: 22,
        username: 'user',
        password: TEST_PASSWORDS.basic,
      }
    })

    connectionHandler(mockSocket)

    // Wait for authentication to complete
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    // Store calls for verification
    const emittedEvents: Array<{ event: string; payload?: any }> = []

    // Create a promise to wait for exec stream events
    const execEventsPromise = new Promise<void>((resolve) => {
      let dataReceived = false
      let execDataReceived = false
      let execExitReceived = false

      const checkComplete = () => {
        if (dataReceived && execDataReceived && execExitReceived) {
          resolve()
        }
      }

      // Monitor socket.emit calls
      const originalEmit = mockSocket.emit
      mockSocket.emit = vi.fn((...args) => {
        const eventName = args[0]
        const payload = args[1]

        // Store the event
        emittedEvents.push({ event: eventName, payload })

        // Call original
        originalEmit.apply(mockSocket, args)

        if (eventName === 'data') {
          dataReceived = true
          checkComplete()
        } else if (eventName === 'exec-data') {
          execDataReceived = true
          checkComplete()
        } else if (eventName === 'exec-exit') {
          execExitReceived = true
          checkComplete()
        }
      })
    })

    // Emit exec request
    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'echo 123' })

    // Wait for all expected events to be emitted
    await execEventsPromise

    // Collect emitted events
    const events = emittedEvents.map(e => e.event)
    expect(events).toContain('data')
    expect(events).toContain('exec-data')
    expect(events).toContain('exec-exit')

    // Verify typed payloads
    const typedPayloads = emittedEvents
      .filter(e => e.event === 'exec-data')
      .map(e => e.payload)

    expect(typedPayloads.some((p: any) => p?.type === 'stdout' && /OUT:echo 123/.test(p?.data))).toBe(true)
    expect(typedPayloads.some((p: any) => p?.type === 'stderr' && /ERR:warn/.test(p?.data))).toBe(true)

    const exitPayloads = emittedEvents
      .filter(e => e.event === 'exec-exit')
      .map(e => e.payload)
    expect(exitPayloads[0]?.code).toBe(0)
  })

  it('should emit error when exec payload is invalid', async () => {
    const connectionHandler = (io.on as any).mock.calls[0].arguments[1]

    mockSocket = createMockSocket({
      usedBasicAuth: true,
      sessionCredentials: {
        host: 'localhost',
        port: 22,
        username: 'user',
        password: TEST_PASSWORDS.basic,
      }
    })

    connectionHandler(mockSocket)
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    // Clear previous calls
    mockSocket.emit.mock.calls.length = 0

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { })
    await new Promise((resolve) => setImmediate(resolve))

    const ssherrorEmits = (mockSocket.emit as any).mock.calls.filter((c: any) => c.arguments[0] === 'ssherror')
    expect(ssherrorEmits.length).toBeGreaterThan(0)
  })
})