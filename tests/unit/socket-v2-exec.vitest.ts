// tests/unit/socket-v2-exec.vitest.ts
// Minimal exec tests for service-based architecture
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { describe, it, beforeEach, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket-v2.js'
import {
  createMockIO,
  createMockSocket,
  createMockSocketConfig,
  createMockServices
} from '../test-utils.js'
import { TEST_PASSWORDS } from '../test-constants.js'

describe('Socket V2 Exec Handler', () => {
  let io: unknown, mockSocket: unknown, mockConfig: unknown, mockServices: unknown

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket()
    mockConfig = createMockSocketConfig()
    mockServices = createMockServices({ authSucceeds: true, sshConnectSucceeds: true, execSucceeds: true })

    socketHandler(io, mockConfig, mockServices)
  })

  it('should handle exec requests without errors', async () => {
    const connectionHandler = (io.on).mock.calls[0][1]

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
    await new Promise<void>((r) => setImmediate(r))
    await new Promise<void>((r) => setImmediate(r))
    await new Promise<void>((r) => setImmediate(r))

    // Clear previous emits
    mockSocket.emit.mock.calls.length = 0

    // Emit exec request
    EventEmitter.prototype.emit.call(mockSocket, 'exec', {
      command: 'echo test',
      term: 'xterm-256color',
      rows: 24,
      cols: 80,
    })

    // Wait for processing
    await new Promise<void>((r) => setImmediate(r))
    await new Promise<void>((r) => setImmediate(r))

    // With services, exec is processed without emitting errors
    const errorEvents = mockSocket.emit.mock.calls.filter((c: unknown[]) => c[0] === 'ssherror')
    expect(errorEvents.length).toBe(0)
  })

  it('should emit error when exec payload is invalid', () => {
    const connectionHandler = (io.on).mock.calls[0][1]
    mockSocket = createMockSocket()
    connectionHandler(mockSocket)

    // Reset emits
    mockSocket.emit.mock.calls.length = 0

    // Send invalid exec request (missing required fields)
    EventEmitter.prototype.emit.call(mockSocket, 'exec', {})

    // Should emit validation error
    const ssherrorEmits = mockSocket.emit.mock.calls.filter((c: unknown[]) => c[0] === 'ssherror')
    expect(ssherrorEmits.length).toBeGreaterThan(0)
  })
})
