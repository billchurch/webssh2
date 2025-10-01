import { describe, it, beforeEach, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import socketHandler from '../../app/socket-v2.js'
import {
  createMockIO,
  createMockSocket,
  createMockSocketConfig,
  createMockServices
} from '../test-utils.js'
import { MOCK_CREDENTIALS } from '../test-constants.js'

// Mock types for socket testing - Vitest style (arrays, not objects with .arguments)
type MockIOCall = [string, (...args: unknown[]) => void]
type MockSocketCall = [string, unknown]

interface MockIO {
  on: {
    mock: {
      calls: MockIOCall[]
    }
  }
}

interface MockSocket extends EventEmitter {
  emit: {
    mock: {
      calls: MockSocketCall[]
    }
  }
  request: {
    session: {
      usedBasicAuth?: boolean
      sshCredentials?: unknown
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isAuthPayload = (
  value: unknown
): value is { success?: boolean; message?: string } => {
  return isRecord(value)
}

describe('Socket.IO Contracts', () => {
  let io: MockIO, mockSocket: MockSocket, mockConfig: unknown, mockServices: unknown

  beforeEach(() => {
    io = createMockIO() as MockIO
    mockSocket = createMockSocket() as MockSocket
    mockConfig = createMockSocketConfig()
    mockServices = createMockServices({ authSucceeds: true, sshConnectSucceeds: true })

    socketHandler(io, mockConfig, mockServices)
  })

  it('emits authentication(request_auth) on new connection without basic auth', () => {
    const connectionHandler = io.on.mock.calls[0][1]
    connectionHandler(mockSocket)
    const [event, payload] = mockSocket.emit.mock.calls[0]
    expect(event).toBe('authentication')
    expect(payload).toEqual({ action: 'request_auth' })
  })

  it('emits explicit failure when authenticate payload invalid', () => {
    const connectionHandler = io.on.mock.calls[0][1]
    connectionHandler(mockSocket)
    // reset emitted calls by reassigning a fresh spy
    mockSocket.emit = vi.fn() as MockSocket['emit']
    EventEmitter.prototype.emit.call(mockSocket, 'authenticate', { host: 'h' })
    const authEvents = mockSocket.emit.mock.calls.filter((c) => c[0] === 'authentication')
    expect(authEvents.length > 0).toBeTruthy()
    const last = authEvents.at(-1)
    expect(last).toBeDefined()
    if (last === undefined) {
      return
    }
    const [, payload] = last
    expect(isAuthPayload(payload)).toBe(true)
    if (!isAuthPayload(payload)) {
      return
    }
    expect(payload.success).toBe(false)
    expect(String(payload.message ?? '')).toMatch(/Invalid credentials/i)
  })

  it('emits permissions after successful connection with expected flags', async () => {
    const connectionHandler = io.on.mock.calls[0][1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
    connectionHandler(mockSocket)

    // Wait for async authentication to complete
    await new Promise<void>((r) => setImmediate(r))
    await new Promise<void>((r) => setImmediate(r))
    await new Promise<void>((r) => setImmediate(r))

    const permEvent = mockSocket.emit.mock.calls.find((c) => c[0] === 'permissions')
    expect(permEvent).toBeDefined()
    if (permEvent === undefined) {
      return
    }
    const [, payload] = permEvent
    expect(isRecord(payload)).toBe(true)
    if (!isRecord(payload)) {
      return
    }
    expect(Object.keys(payload).sort()).toEqual(['allowReauth', 'allowReconnect', 'allowReplay', 'autoLog'].sort())
  })
})
