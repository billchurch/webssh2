// tests/unit/socket-v2-exec-edge-cases.vitest.ts
// Vitest rewrite of socket exec edge cases test

import { describe, it, beforeEach, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket-v2.js'
import { MOCK_CREDENTIALS } from '../test-constants.js'

describe('Socket V2 Exec Edge Cases', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any

  beforeEach(() => {
    io = new EventEmitter()
    io.on = vi.fn(io.on.bind(io))

    mockSocket = new EventEmitter()
    mockSocket.id = 'neg-exec-more'
    mockSocket.request = {
      session: { save: vi.fn((cb: () => void) => cb()), sshCredentials: null, usedBasicAuth: false, envVars: null },
    }
    mockSocket.emit = vi.fn()
    mockSocket.disconnect = vi.fn()

    mockConfig = {
      ssh: { term: 'xterm-color', disableInteractiveAuth: false },
      options: { allowReauth: true, allowReplay: true, allowReconnect: true },
      user: {},
      header: null,
    }

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
    const onConn = (io.on as any).mock.calls[0][1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
    onConn(mockSocket)

    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))

    // Track emitted events
    const emittedEvents: Array<{ event: string; payload?: any }> = []
    const originalEmit = mockSocket.emit
    mockSocket.emit = vi.fn((...args) => {
      emittedEvents.push({ event: args[0], payload: args[1] })
      return originalEmit.apply(mockSocket, args)
    })

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 123 })
    await new Promise((r) => setImmediate(r))

    const ssherrorEmits = emittedEvents.filter(e => e.event === 'ssherror')
    expect(ssherrorEmits.length).toBeGreaterThan(0)
  })

  it('exec: exit payload contains code and signal', async () => {
    const onConn = (io.on as any).mock.calls[0][1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
    onConn(mockSocket)

    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))

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