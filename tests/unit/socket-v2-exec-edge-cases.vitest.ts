// tests/unit/socket-v2-exec-edge-cases.vitest.ts
// Vitest rewrite of socket exec edge cases test

import { describe, it, beforeEach, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket-v2.js'
import {
  createMockSocket,
  createMockIO,
  createMockConfig,
  setupAuthenticatedSocket,
  trackEmittedEvents,
  waitForAsync
} from './socket-v2-test-utils.js'
import { createMockSSHConnection } from '../test-utils.js'

describe('Socket V2 Exec Edge Cases', () => {
  let io: unknown, mockSocket: unknown, mockConfig: unknown, MockSSHConnection: unknown

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket('neg-exec-more')
    mockConfig = createMockConfig()

    // Use shared mock SSH connection with exec methods
    MockSSHConnection = createMockSSHConnection({
      withExecMethods: true,
      connectResolves: true,
      shellResolves: true
    })

    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('exec: non-string command → ssherror', async () => {
    await setupAuthenticatedSocket(io, mockSocket)
    const emittedEvents = trackEmittedEvents(mockSocket)

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 123 })
    await waitForAsync()

    const ssherrorEmits = emittedEvents.filter(e => e.event === 'ssherror')
    expect(ssherrorEmits.length).toBeGreaterThan(0)
  })

  it('exec: exit payload contains code and signal', async () => {
    await setupAuthenticatedSocket(io, mockSocket)

    // Set up promise to wait for exec-exit event
    const execExitPromise = new Promise<{ code: number; signal: string | null }>((resolve) => {
      const originalEmit = (mockSocket as any).emit
      ;(mockSocket as any).emit = vi.fn((...args: any[]) => {
        ;(originalEmit).apply(mockSocket, args)
        if (args[0] === 'exec-exit') {
          resolve(args[1])
        }
      })
    })

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'test' })

    // Wait for exec-exit event
    const exitPayload = await execExitPromise

    expect(exitPayload).toBeDefined()
    expect(exitPayload.code).toBe(0)
    expect(exitPayload.signal).toBe(null)
  })
})