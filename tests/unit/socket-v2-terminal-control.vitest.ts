// tests/unit/socket-v2-terminal-control.vitest.ts
// Vitest rewrite of socket terminal and control functionality tests

import { describe, it, beforeEach, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket-v2.js'
import {
  createMockSocket,
  createMockIO,
  createMockConfig,
  setupAuthenticatedSocket,
  filterEventsByType,
  emitSocketEvent,
  setupAuthenticatedSocketWithTracking,
  createTerminalSession
} from './socket-v2-test-utils.js'

describe('Socket V2 Terminal and Control', () => {
  let io: unknown, mockSocket: unknown, mockConfig: unknown, MockSSHConnection: unknown

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket('neg-socket-id')
    mockConfig = createMockConfig()

    class SSH extends EventEmitter {
      resizeTerminal: unknown
      constructor() {
        super()
        this.resizeTerminal = vi.fn()
      }
      connect(): Promise<void> { return Promise.resolve() }
      shell(_options: unknown): Promise<unknown> {
        const stream = new EventEmitter() as EventEmitter & { write: (...args: unknown[]) => void }

        stream.write = (): void => { /* no-op for mock */ }
        return Promise.resolve(stream)
      }
      exec(): Promise<EventEmitter> { return Promise.resolve(new EventEmitter()) }
      end(): void {
        // no-op - mock connection cleanup
      }
    }
    MockSSHConnection = SSH

    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('terminal: handles invalid terminal settings gracefully', async () => {
    const emittedEvents = await setupAuthenticatedSocketWithTracking(io, mockSocket)

    // Send terminal settings with invalid values
    await emitSocketEvent(mockSocket, 'terminal', { rows: 'abc', cols: 'xyz' }, 2)

    // V2 correctly emits an error for invalid terminal settings (improvement over V1)
    const errorEvents = filterEventsByType(emittedEvents, 'ssherror')
    expect(errorEvents.length).toBe(1)
    expect(errorEvents[0].payload).toBe('Invalid columns value')
  })

  it('resize: silently ignores invalid resize values', async () => {
    const emittedEvents = await setupAuthenticatedSocketWithTracking(io, mockSocket)

    // First create shell with defaults via terminal event
    await createTerminalSession(mockSocket)

    // Clear previous events
    emittedEvents.length = 0

    // Now send invalid resize payload
    await emitSocketEvent(mockSocket, 'resize', { rows: 'NaN', cols: 'oops' })

    // V2 should silently ignore invalid resize values without emitting errors
    const errorEvents = filterEventsByType(emittedEvents, 'ssherror')
    expect(errorEvents.length).toBe(0)
  })

  it('control: silently ignores invalid control commands (V2 improvement)', async () => {
    await setupAuthenticatedSocket(io, mockSocket)

    // Mock console.warn to ensure it's NOT called (V2 improvement)
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await createTerminalSession(mockSocket)

    // Send invalid control command
    await emitSocketEvent(mockSocket, 'control', 'bad-cmd')

    // V2 should silently ignore invalid control commands without logging warnings
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('control: handles valid control commands (reauth)', async () => {
    const emittedEvents = await setupAuthenticatedSocketWithTracking(io, mockSocket)

    await createTerminalSession(mockSocket)

    // Clear previous events
    emittedEvents.length = 0

    // Send valid control command
    await emitSocketEvent(mockSocket, 'control', 'reauth')

    // Should emit reauth response
    const authEvents = filterEventsByType(emittedEvents, 'authentication')
    expect(authEvents.length).toBeGreaterThan(0)
    expect(authEvents[0].payload).toEqual({ action: 'reauth' })
  })
})