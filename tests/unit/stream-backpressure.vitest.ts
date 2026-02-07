// tests/unit/stream-backpressure.vitest.ts
// Unit tests for stream backpressure configuration and data flow behavior

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { createCompleteDefaultConfig } from '../../app/config/default-config.js'
import {
  ServiceSocketTerminal,
  getWebSocketBufferedBytes,
  computeBackpressureAction
} from '../../app/socket/adapters/service-socket-terminal.js'
import type { AdapterContext, SSH2Stream } from '../../app/socket/adapters/service-socket-shared.js'
import { SOCKET_EVENTS } from '../../app/constants/socket-events.js'

describe('Stream Backpressure Configuration', () => {
  it('should have default maxExecOutputBytes of 10MB', () => {
    const config = createCompleteDefaultConfig()
    expect(config.ssh.maxExecOutputBytes).toBe(10 * 1024 * 1024)
  })

  it('should have default outputRateLimitBytesPerSec of 0 (unlimited)', () => {
    const config = createCompleteDefaultConfig()
    expect(config.ssh.outputRateLimitBytesPerSec).toBe(0)
  })

  it('should have default socketHighWaterMark of 16KB', () => {
    const config = createCompleteDefaultConfig()
    expect(config.ssh.socketHighWaterMark).toBe(16 * 1024)
  })

  it('should allow custom maxExecOutputBytes override', () => {
    const config = createCompleteDefaultConfig()
    config.ssh.maxExecOutputBytes = 5 * 1024 * 1024 // 5MB
    expect(config.ssh.maxExecOutputBytes).toBe(5 * 1024 * 1024)
  })

  it('should allow rate limiting to be enabled', () => {
    const config = createCompleteDefaultConfig()
    config.ssh.outputRateLimitBytesPerSec = 1024 * 1024 // 1MB/s
    expect(config.ssh.outputRateLimitBytesPerSec).toBe(1024 * 1024)
  })

  it('should validate rate limit is disabled when set to 0', () => {
    const config = createCompleteDefaultConfig()
    config.ssh.outputRateLimitBytesPerSec = 0
    expect(config.ssh.outputRateLimitBytesPerSec).toBe(0)
  })
})

vi.mock('../../app/logging/socket-logger.js', () => ({
  emitSocketLog: vi.fn()
}))

function createMockStream(): SSH2Stream & EventEmitter {
  const emitter = new EventEmitter()
  const stream = Object.assign(emitter, {
    pause: vi.fn(),
    resume: vi.fn(),
    write: vi.fn(),
    pipe: vi.fn(),
    unpipe: vi.fn(),
    read: vi.fn(),
    setEncoding: vi.fn(),
    destroy: vi.fn(),
    writable: true,
    readable: true
  })
  return stream as unknown as SSH2Stream & EventEmitter
}

function createMockContext(
  overrides?: { bufferedAmount?: number; transportName?: string }
): AdapterContext {
  const conn = new EventEmitter()
  const transportName = overrides?.transportName ?? 'websocket'
  const bufferedAmount = overrides?.bufferedAmount ?? 0

  Object.assign(conn, {
    transport: {
      name: transportName,
      socket: {
        get bufferedAmount() {
          return bufferedAmount
        }
      }
    }
  })

  return {
    socket: {
      emit: vi.fn(),
      disconnect: vi.fn(),
      conn
    },
    config: {
      ssh: {
        outputRateLimitBytesPerSec: 0,
        socketHighWaterMark: 16384
      }
    },
    services: {
      terminal: {
        create: vi.fn(),
        getTerminal: vi.fn(),
        resize: vi.fn()
      },
      ssh: {
        shell: vi.fn(),
        exec: vi.fn()
      }
    },
    state: {
      sessionId: 'test-session-id',
      connectionId: 'test-connection-id',
      shellStream: null,
      storedPassword: null,
      originalAuthMethod: null,
      initialTermSettings: {},
      clientIp: null,
      clientPort: null,
      clientSourcePort: null,
      targetHost: null,
      targetPort: null,
      username: null,
      userAgent: null,
      requestedKeyboardInteractive: false
    },
    debug: vi.fn(),
    authPipeline: {} as AdapterContext['authPipeline'],
    logger: {} as AdapterContext['logger']
  } as unknown as AdapterContext
}

describe('computeBackpressureAction', () => {
  const HWM = 16384
  const LWM = Math.floor(HWM / 4) // 4096

  it('returns "none" when bufferedBytes is null', () => {
    expect(computeBackpressureAction(null, HWM, false)).toBe('none')
    expect(computeBackpressureAction(null, HWM, true)).toBe('none')
  })

  it('returns "pause" when buffer >= HWM and not paused', () => {
    expect(computeBackpressureAction(HWM, HWM, false)).toBe('pause')
    expect(computeBackpressureAction(HWM + 1000, HWM, false)).toBe('pause')
  })

  it('returns "none" when buffer < HWM and not paused (normal flow)', () => {
    expect(computeBackpressureAction(0, HWM, false)).toBe('none')
    expect(computeBackpressureAction(1000, HWM, false)).toBe('none')
    expect(computeBackpressureAction(HWM - 1, HWM, false)).toBe('none')
  })

  it('returns "resume" when buffer < LWM and paused', () => {
    expect(computeBackpressureAction(0, HWM, true)).toBe('resume')
    expect(computeBackpressureAction(LWM - 1, HWM, true)).toBe('resume')
  })

  it('returns "none" when paused but buffer between LWM and HWM (hysteresis)', () => {
    expect(computeBackpressureAction(LWM, HWM, true)).toBe('none')
    expect(computeBackpressureAction(LWM + 1000, HWM, true)).toBe('none')
    expect(computeBackpressureAction(HWM - 1, HWM, true)).toBe('none')
  })

  it('returns "none" when already paused and still above HWM', () => {
    expect(computeBackpressureAction(HWM, HWM, true)).toBe('none')
    expect(computeBackpressureAction(HWM + 5000, HWM, true)).toBe('none')
  })
})

describe('getWebSocketBufferedBytes', () => {
  it('returns bufferedAmount when transport is websocket', () => {
    const ctx = createMockContext({ bufferedAmount: 12345 })
    expect(getWebSocketBufferedBytes(ctx.socket)).toBe(12345)
  })

  it('returns null when transport is not websocket', () => {
    const ctx = createMockContext({ transportName: 'polling' })
    expect(getWebSocketBufferedBytes(ctx.socket)).toBeNull()
  })

  it('returns null when conn is missing', () => {
    const ctx = createMockContext()
    ;(ctx.socket as unknown as { conn: undefined }).conn = undefined
    expect(getWebSocketBufferedBytes(ctx.socket)).toBeNull()
  })

  it('returns null when transport is missing', () => {
    const ctx = createMockContext()
    const conn = ctx.socket.conn as unknown as Record<string, unknown>
    conn.transport = undefined
    expect(getWebSocketBufferedBytes(ctx.socket)).toBeNull()
  })

  it('returns 0 when buffer is empty', () => {
    const ctx = createMockContext({ bufferedAmount: 0 })
    expect(getWebSocketBufferedBytes(ctx.socket)).toBe(0)
  })
})

describe('Shell Data Flow', () => {
  let mockStream: SSH2Stream & EventEmitter
  let mockContext: AdapterContext

  beforeEach(() => {
    mockStream = createMockStream()
    mockContext = createMockContext()
  })

  it('emits SSH data to socket without pausing the stream', () => {
    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    mockStream.emit('data', Buffer.from('hello'))

    expect(mockStream.pause).not.toHaveBeenCalled()
    expect(mockContext.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_DATA, Buffer.from('hello'))
  })

  it('handles multiple rapid data chunks without pausing', () => {
    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    mockStream.emit('data', Buffer.from('chunk1'))
    mockStream.emit('data', Buffer.from('chunk2'))
    mockStream.emit('data', Buffer.from('chunk3'))

    expect(mockStream.pause).not.toHaveBeenCalled()
    expect(mockContext.socket.emit).toHaveBeenCalledTimes(3)
    expect(mockContext.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_DATA, Buffer.from('chunk1'))
    expect(mockContext.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_DATA, Buffer.from('chunk2'))
    expect(mockContext.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_DATA, Buffer.from('chunk3'))
  })

  it('emits raw buffer data without string conversion', () => {
    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    const testBuffer = Buffer.from('test output\r\n')
    mockStream.emit('data', testBuffer)

    expect(mockContext.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_DATA, testBuffer)
  })

  it('disconnects socket when stream closes', () => {
    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    mockStream.emit('close')

    expect(mockContext.socket.disconnect).toHaveBeenCalled()
  })
})

describe('Shell Data Flow with Backpressure', () => {
  let mockStream: SSH2Stream & EventEmitter

  beforeEach(() => {
    mockStream = createMockStream()
  })

  it('pauses stream when bufferedAmount exceeds high water mark', () => {
    const mockContext = createMockContext({ bufferedAmount: 20000 })
    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    mockStream.emit('data', Buffer.from('flood'))

    // Data is still emitted (as raw Buffer)
    expect(mockContext.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_DATA, Buffer.from('flood'))
    // But stream is paused after emit
    expect(mockStream.pause).toHaveBeenCalled()
  })

  it('does not pause when bufferedAmount is below high water mark', () => {
    const mockContext = createMockContext({ bufferedAmount: 100 })
    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    mockStream.emit('data', Buffer.from('normal'))

    expect(mockContext.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_DATA, Buffer.from('normal'))
    expect(mockStream.pause).not.toHaveBeenCalled()
  })

  it('resumes stream when drain fires and buffer is below low water mark', () => {
    vi.useFakeTimers()

    // Start with high buffer to trigger pause
    let currentBuffered = 20000
    const conn = new EventEmitter()
    Object.assign(conn, {
      transport: {
        name: 'websocket',
        socket: {
          get bufferedAmount() {
            return currentBuffered
          }
        }
      }
    })

    const mockContext = createMockContext()
    ;(mockContext.socket as unknown as { conn: EventEmitter }).conn = conn

    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    // Trigger backpressure
    mockStream.emit('data', Buffer.from('flood'))
    expect(mockStream.pause).toHaveBeenCalled()

    // Simulate buffer draining below low water mark (HWM/4 = 4096)
    currentBuffered = 1000
    conn.emit('drain')

    expect(mockStream.resume).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('resumes stream via timer poll when drain does not fire', () => {
    vi.useFakeTimers()

    let currentBuffered = 20000
    const conn = new EventEmitter()
    Object.assign(conn, {
      transport: {
        name: 'websocket',
        socket: {
          get bufferedAmount() {
            return currentBuffered
          }
        }
      }
    })

    const mockContext = createMockContext()
    ;(mockContext.socket as unknown as { conn: EventEmitter }).conn = conn

    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    // Trigger backpressure
    mockStream.emit('data', Buffer.from('flood'))
    expect(mockStream.pause).toHaveBeenCalled()

    // Simulate buffer draining below LWM, then advance timer
    currentBuffered = 500
    vi.advanceTimersByTime(50)

    expect(mockStream.resume).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('does not resume when buffer is between LWM and HWM (hysteresis)', () => {
    vi.useFakeTimers()

    let currentBuffered = 20000
    const conn = new EventEmitter()
    Object.assign(conn, {
      transport: {
        name: 'websocket',
        socket: {
          get bufferedAmount() {
            return currentBuffered
          }
        }
      }
    })

    const mockContext = createMockContext()
    ;(mockContext.socket as unknown as { conn: EventEmitter }).conn = conn

    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    // Trigger backpressure
    mockStream.emit('data', Buffer.from('flood'))
    expect(mockStream.pause).toHaveBeenCalled()

    // Buffer drops to between LWM (4096) and HWM (16384) — should NOT resume
    currentBuffered = 8000
    conn.emit('drain')

    expect(mockStream.resume).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('always emits data regardless of backpressure state', () => {
    // Use a mutable bufferedAmount that starts high
    let currentBuffered = 20000
    const conn = new EventEmitter()
    Object.assign(conn, {
      transport: {
        name: 'websocket',
        socket: {
          get bufferedAmount() {
            return currentBuffered
          }
        }
      }
    })

    const mockContext = createMockContext()
    ;(mockContext.socket as unknown as { conn: EventEmitter }).conn = conn

    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    // First chunk triggers backpressure
    mockStream.emit('data', Buffer.from('first'))
    expect(mockContext.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_DATA, Buffer.from('first'))
    expect(mockStream.pause).toHaveBeenCalled()

    // Even if more data arrives (buffered in Node.js), it is still emitted
    // (backpressure only pauses the source stream, doesn't drop data)
    currentBuffered = 30000
    mockStream.emit('data', Buffer.from('second'))
    expect(mockContext.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_DATA, Buffer.from('second'))
  })

  it('clears timers on stream close', () => {
    vi.useFakeTimers()

    const mockContext = createMockContext({ bufferedAmount: 20000 })
    const terminal = new ServiceSocketTerminal(mockContext)
    const setupFlow = terminal as unknown as { setupShellDataFlow(stream: SSH2Stream): void }
    setupFlow.setupShellDataFlow(mockStream)

    // Trigger backpressure (sets up timer)
    mockStream.emit('data', Buffer.from('flood'))
    expect(mockStream.pause).toHaveBeenCalled()

    // Close stream — should clean up without errors
    mockStream.emit('close')

    // Advancing timers should not cause errors
    vi.advanceTimersByTime(100)

    expect(mockContext.socket.disconnect).toHaveBeenCalled()

    vi.useRealTimers()
  })
})
