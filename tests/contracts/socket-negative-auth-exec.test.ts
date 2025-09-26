import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import type { Config } from '../../app/types/config.js'
import socketHandler from '../../dist/app/socket-v2.js'
import { MOCK_CREDENTIALS } from '../test-constants.js'

void describe('Socket.IO Negative: authenticate + exec env', () => {
  let io: EventEmitter & { on: ReturnType<typeof mock.fn> }
  let mockSocket: EventEmitter & {
    id: string
    request: { session: { save: ReturnType<typeof mock.fn>; sshCredentials: unknown; usedBasicAuth: boolean; envVars: unknown } }
    emit: ReturnType<typeof mock.fn>
    disconnect: ReturnType<typeof mock.fn>
  }
  let mockConfig: Partial<Config>
  let MockSSHConnection: typeof EventEmitter
  let capturedEnv: unknown
  let _capturedOptions: unknown
  let execResolve: (() => void) | undefined

  beforeEach(() => {
    io = new EventEmitter() as EventEmitter & { on: ReturnType<typeof mock.fn> }
    io.on = mock.fn(io.on.bind(io)) as ReturnType<typeof mock.fn>

    mockSocket = new EventEmitter() as EventEmitter & {
      id: string
      request: { session: { save: ReturnType<typeof mock.fn>; sshCredentials: unknown; usedBasicAuth: boolean; envVars: unknown } }
      emit: ReturnType<typeof mock.fn>
      disconnect: ReturnType<typeof mock.fn>
    }
    mockSocket.id = 'neg-auth-exec'
    mockSocket.request = {
      session: { save: mock.fn((cb: () => void) => cb()), sshCredentials: null, usedBasicAuth: false, envVars: null },
    }
    mockSocket.emit = mock.fn()
    mockSocket.disconnect = mock.fn()

    mockConfig = {
      ssh: { term: 'xterm-color', disableInteractiveAuth: false },
      options: { allowReauth: true, allowReplay: true, allowReconnect: true },
      user: {},
      header: null,
    }

    class SSH extends EventEmitter {
      connect(): Promise<void> { return Promise.resolve() }
      shell(): Promise<EventEmitter & { write: () => void }> {
        const s = new EventEmitter() as EventEmitter & { write: () => void }
        s.write = (): void => { /* no-op for mock */ }
        return Promise.resolve(s)
      }
      exec(_cmd: string, _options: unknown, env: unknown): Promise<EventEmitter & { stderr: EventEmitter }> {
        capturedEnv = env
        if (execResolve !== undefined) { execResolve() }
        const s = new EventEmitter() as EventEmitter & { stderr: EventEmitter }
        s.stderr = new EventEmitter()
        process.nextTick(() => {
          s.emit('data', Buffer.from('OUT'))
          s.stderr.emit('data', Buffer.from('ERR'))
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

  void it('authenticate: string port and missing secrets → invalid credentials', () => {
    const onConn = io.on.mock.calls[0]?.arguments[1] as (socket: typeof mockSocket) => void
    onConn(mockSocket)
    mockSocket.emit = mock.fn()

    // Port provided as string, no password/privateKey
    EventEmitter.prototype.emit.call(mockSocket, 'authenticate', {
      username: 'u', host: 'h', port: '22'
    })

    const authEvents = mockSocket.emit.mock.calls.filter((c: { arguments: unknown[] }) => c.arguments[0] === 'authentication')
    assert.ok(authEvents.length > 0)
    const lastAuthEvent = authEvents[authEvents.length - 1]
    const lastAuth = lastAuthEvent?.arguments[1] as { success: boolean; message?: string }
    assert.equal(lastAuth.success, false)
    assert.match(String(lastAuth.message ?? ''), /Invalid credentials/i)
  })

  void it('exec: env passes session.envVars for AcceptEnv support', async () => {
    const onConn = io.on.mock.calls[0]?.arguments[1] as (socket: typeof mockSocket) => void
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
    mockSocket.request.session.envVars = { FOO: 'bar' }
    onConn(mockSocket)

    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))

    const execPromise = new Promise((resolve) => { execResolve = resolve })

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'echo' })

    // Wait for the mock exec to be called
    await execPromise

    assert.deepEqual(capturedEnv, { FOO: 'bar' }, 'session.envVars passed to exec')
  })
})