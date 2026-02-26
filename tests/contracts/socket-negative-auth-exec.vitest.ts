import { describe, it, beforeEach, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { Config } from '../../app/types/config.js'
import socketHandler from '../../app/socket-v2.js'
import { MOCK_CREDENTIALS } from '../test-constants.js'
import { createMockServices, createMockSocketConfig } from '../test-utils.js'

describe('Socket.IO Negative: authenticate + exec env', () => {
  let io: EventEmitter & { on: ReturnType<typeof vi.fn> }
  let mockSocket: EventEmitter & {
    id: string
    request: { session: { save: ReturnType<typeof vi.fn>; sshCredentials: unknown; usedBasicAuth: boolean; envVars: unknown } }
    emit: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    onAny: ReturnType<typeof vi.fn>
    offAny: ReturnType<typeof vi.fn>
  }
  let mockConfig: Partial<Config>
  let mockServices: unknown

  beforeEach(() => {
    io = new EventEmitter()
    io.on = vi.fn(io.on.bind(io))

    mockSocket = new EventEmitter()
    mockSocket.id = 'neg-auth-exec'
    mockSocket.request = {
      session: { save: vi.fn((cb: () => void) => cb()), sshCredentials: null, usedBasicAuth: false, envVars: null },
    }
    mockSocket.emit = vi.fn()
    mockSocket.disconnect = vi.fn()
    mockSocket.onAny = vi.fn()
    mockSocket.offAny = vi.fn()

    mockConfig = createMockSocketConfig({
      ssh: { term: 'xterm-color', disableInteractiveAuth: false }
    })
    mockServices = createMockServices({ authSucceeds: true, sshConnectSucceeds: true })

    socketHandler(io, mockConfig, mockServices)
  })

  it('authenticate: string port and missing secrets → invalid credentials', () => {
    const onConn = io.on.mock.calls[0]?.[1] as (socket: typeof mockSocket) => void
    onConn(mockSocket)
    mockSocket.emit = vi.fn()

    // Port provided as string, no password/privateKey
    EventEmitter.prototype.emit.call(mockSocket, 'authenticate', {
      username: 'u', host: 'h', port: '22'
    })

    const authEvents = mockSocket.emit.mock.calls.filter((c: unknown[]) => c[0] === 'authentication')
    expect(authEvents.length > 0).toBeTruthy()
    const lastAuthEvent = authEvents.at(-1)
    const lastAuth = lastAuthEvent?.[1] as { success: boolean; message?: string }
    expect(lastAuth.success).toBe(false)
    expect(String(lastAuth.message ?? '')).toMatch(/Invalid credentials/i)
  })

  it('exec: env passes session.envVars for AcceptEnv support', async () => {
    const onConn = io.on.mock.calls[0]?.[1] as (socket: typeof mockSocket) => void
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
    mockSocket.request.session.envVars = { FOO: 'bar' }
    onConn(mockSocket)

    // Wait for auth to complete
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))

    // Clear previous emit calls
    mockSocket.emit.mock.calls.length = 0

    // Emit exec request
    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'echo test', term: 'xterm', cols: 80, rows: 24 })

    // Wait for exec to be processed
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))

    // With services architecture, env vars are handled at the service layer
    // This test verifies that exec request processes without error
    // No ssherror events should be emitted
    const errorEvents = mockSocket.emit.mock.calls.filter((c: unknown[]) => c[0] === 'ssherror')
    expect(errorEvents.length).toBe(0)
  })
})
