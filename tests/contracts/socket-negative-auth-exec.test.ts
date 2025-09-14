import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket.js'

describe('Socket.IO Negative: authenticate + exec env', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any, capturedEnv: any, capturedOptions: any

  beforeEach(() => {
    io = new EventEmitter()
    io.on = mock.fn(io.on)

    mockSocket = new EventEmitter()
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
      async connect() { return }
      async shell() { const s: any = new EventEmitter(); s.write = () => {}; return s }
      async exec(_cmd: string, options: any, env: any) {
        capturedOptions = options
        capturedEnv = env
        const s: any = new EventEmitter()
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

  it('authenticate: string port and missing secrets → invalid credentials', () => {
    const onConn = (io.on as any).mock.calls[0].arguments[1]
    onConn(mockSocket)
    mockSocket.emit = mock.fn()

    // Port provided as string, no password/privateKey
    EventEmitter.prototype.emit.call(mockSocket, 'authenticate', {
      username: 'u', host: 'h', port: '22'
    })

    const authEvents = (mockSocket.emit as any).mock.calls.filter((c: any) => c.arguments[0] === 'authentication')
    assert.ok(authEvents.length > 0)
    const lastAuth = authEvents[authEvents.length - 1].arguments[1]
    assert.equal(lastAuth.success, false)
    assert.match(String(lastAuth.message || ''), /Invalid credentials/i)
  })

  it('exec: env passes session.envVars for AcceptEnv support', async () => {
    const onConn = (io.on as any).mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    mockSocket.request.session.envVars = { FOO: 'bar' }
    onConn(mockSocket)

    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'echo' })
    await new Promise((r) => setImmediate(r))

    assert.deepEqual(capturedEnv, { FOO: 'bar' }, 'session.envVars passed to exec')
  })
})