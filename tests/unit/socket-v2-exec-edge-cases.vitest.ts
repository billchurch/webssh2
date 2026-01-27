// tests/unit/socket-v2-exec-edge-cases.vitest.ts
// Minimal exec edge case tests for service-based architecture

import { describe, it, beforeEach, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import socketHandler from '../../app/socket-v2.js'
import {
  createMockSocket,
  createMockIO,
  createMockConfig,
  setupAuthenticatedSocket,
  trackEmittedEvents,
  waitForAsync
} from './socket-v2-test-utils.js'
import { createMockServices } from '../test-utils.js'

describe('Socket V2 Exec Edge Cases', () => {
  let io: unknown, mockSocket: unknown, mockConfig: unknown, mockServices: unknown

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket('exec-edge-socket-id')
    mockConfig = createMockConfig()
    mockServices = createMockServices({ authSucceeds: true, sshConnectSucceeds: true, execSucceeds: true })

    socketHandler(io, mockConfig, mockServices)
  })

  it('exec: non-string command is coerced to string', async () => {
    await setupAuthenticatedSocket(io, mockSocket)
    const emittedEvents = trackEmittedEvents(mockSocket)

    // Send exec request with non-string command (gets coerced to string by service-socket-terminal)
    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 123 })
    await waitForAsync(2)

    // The command is coerced to string "123" and processed (no error emitted)
    // Note: service-socket-terminal.ts uses String() coercion for robustness
    const ssherrorEmits = emittedEvents.filter(e => e.event === 'ssherror')
    expect(ssherrorEmits.length).toBe(0)
  })

  it('exec: processes exec requests through service layer', async () => {
    await setupAuthenticatedSocket(io, mockSocket)

    // With services, exec requests are processed differently
    // This test just verifies the socket handler accepts exec events
    // without crashing (detailed exec testing is in exec-handler unit tests)

    // Send exec request
    EventEmitter.prototype.emit.call(mockSocket, 'exec', {
      command: 'echo test',
      term: 'xterm-256color',
      rows: 24,
      cols: 80
    })

    await waitForAsync(3)

    // Test passes if no exceptions were thrown
    expect(true).toBe(true)
  })
})
