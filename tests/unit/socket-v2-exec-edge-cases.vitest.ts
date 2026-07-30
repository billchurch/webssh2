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
    expect(ssherrorEmits).toHaveLength(0)
  })

  it('exec: processes exec requests through service layer', async () => {
    await setupAuthenticatedSocket(io, mockSocket)
    const emittedEvents = trackEmittedEvents(mockSocket)

    // Send exec request
    EventEmitter.prototype.emit.call(mockSocket, 'exec', {
      command: 'echo test',
      term: 'xterm-256color',
      rows: 24,
      cols: 80
    })

    await waitForAsync(3)

    // The service layer streams the command output back without erroring
    expect(emittedEvents.map(e => e.event)).not.toContain('ssherror')
    expect(emittedEvents.map(e => e.event)).toContain('data')
  })
})
