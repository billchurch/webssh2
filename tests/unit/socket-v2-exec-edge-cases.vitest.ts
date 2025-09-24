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

describe('Socket V2 Exec Edge Cases', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket('neg-exec-more')
    mockConfig = createMockConfig()

    class SSH extends EventEmitter {
      async connect() { return }
      async shell() { const s: any = new EventEmitter(); s.write = () => {}; return s }
      async exec(_cmd: string, _options: any) {
        const s: any = new EventEmitter()
        s.stderr = new EventEmitter()
        process.nextTick(() => {
          s.emit('data', Buffer.from('X'))
          s.stderr.emit('data', Buffer.from('E'))
          s.emit('close', 0, null)
        })
        return s
      }
      end(): void {
        // no-op - mock connection cleanup
      }
    }
    MockSSHConnection = SSH

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
    const execExitPromise = new Promise<any>((resolve) => {
      const originalEmit = mockSocket.emit
      mockSocket.emit = vi.fn((...args) => {
        originalEmit.apply(mockSocket, args)
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