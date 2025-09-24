// tests/unit/socket-v2-terminal-control.vitest.ts
// Vitest rewrite of socket terminal and control functionality tests

import { describe, it, beforeEach, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket-v2.js'
import { MOCK_CREDENTIALS } from '../test-constants.js'

describe('Socket V2 Terminal and Control', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any

  beforeEach(() => {
    io = new EventEmitter()
    io.on = vi.fn(io.on.bind(io))

    mockSocket = new EventEmitter()
    mockSocket.id = 'neg-socket-id'
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
      resizeTerminal: any
      constructor() {
        super()
        this.resizeTerminal = vi.fn()
      }
      async connect() { return }
      async shell(options: any) {
        const stream: any = new EventEmitter()
        stream.write = () => {}
        return stream
      }
      async exec() { return new EventEmitter() }
      end(): void {
        // no-op - mock connection cleanup
      }
    }
    MockSSHConnection = SSH

    socketHandler(io, mockConfig, MockSSHConnection)
  })

  // Helper function to setup authenticated socket
  const setupAuthenticatedSocket = async () => {
    const onConn = (io.on as any).mock.calls[0][1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
    onConn(mockSocket)

    // Wait for authentication
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))
  }

  // Helper function to track emitted events
  const trackEmittedEvents = () => {
    const emittedEvents: Array<{ event: string; payload?: any }> = []
    const originalEmit = mockSocket.emit
    mockSocket.emit = vi.fn((...args) => {
      emittedEvents.push({ event: args[0], payload: args[1] })
      return originalEmit.apply(mockSocket, args)
    })
    return emittedEvents
  }

  // Helper function to wait for async operations
  const waitForAsync = async (iterations = 1) => {
    for (let i = 0; i < iterations; i++) {
      await new Promise((r) => setImmediate(r))
    }
  }

  it('terminal: handles invalid terminal settings gracefully', async () => {
    await setupAuthenticatedSocket()
    const emittedEvents = trackEmittedEvents()

    // Send terminal settings with invalid values
    EventEmitter.prototype.emit.call(mockSocket, 'terminal', { rows: 'abc', cols: 'xyz' })
    await waitForAsync(2)

    // V2 correctly emits an error for invalid terminal settings (improvement over V1)
    const errorEvents = emittedEvents.filter(e => e.event === 'ssherror')
    expect(errorEvents.length).toBe(1)
    expect(errorEvents[0].payload).toBe('Invalid columns value')
  })

  it('resize: silently ignores invalid resize values', async () => {
    await setupAuthenticatedSocket()
    const emittedEvents = trackEmittedEvents()

    // First create shell with defaults via terminal event
    EventEmitter.prototype.emit.call(mockSocket, 'terminal', {})
    await waitForAsync()

    // Clear previous events
    emittedEvents.length = 0

    // Now send invalid resize payload
    EventEmitter.prototype.emit.call(mockSocket, 'resize', { rows: 'NaN', cols: 'oops' })
    await waitForAsync()

    // V2 should silently ignore invalid resize values without emitting errors
    const errorEvents = emittedEvents.filter(e => e.event === 'ssherror')
    expect(errorEvents.length).toBe(0)
  })

  it('control: silently ignores invalid control commands (V2 improvement)', async () => {
    await setupAuthenticatedSocket()

    // Mock console.warn to ensure it's NOT called (V2 improvement)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    EventEmitter.prototype.emit.call(mockSocket, 'terminal', {})
    await waitForAsync()

    // Send invalid control command
    EventEmitter.prototype.emit.call(mockSocket, 'control', 'bad-cmd')
    await waitForAsync()

    // V2 should silently ignore invalid control commands without logging warnings
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('control: handles valid control commands (reauth)', async () => {
    await setupAuthenticatedSocket()
    const emittedEvents = trackEmittedEvents()

    EventEmitter.prototype.emit.call(mockSocket, 'terminal', {})
    await waitForAsync()

    // Clear previous events
    emittedEvents.length = 0

    // Send valid control command
    EventEmitter.prototype.emit.call(mockSocket, 'control', 'reauth')
    await waitForAsync()

    // Should emit reauth response
    const authEvents = emittedEvents.filter(e => e.event === 'authentication')
    expect(authEvents.length).toBeGreaterThan(0)
    expect(authEvents[0].payload).toEqual({ action: 'reauth' })
  })
})