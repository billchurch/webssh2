import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../../app/socket.js'

describe('Socket.IO Negative: authenticate + exec env', () => {
  let io, mockSocket, mockConfig, MockSSHConnection, capturedEnv, capturedOptions

  beforeEach(() => {
    io = new EventEmitter()
    io.on = mock.fn(io.on)

    mockSocket = new EventEmitter()
    mockSocket.id = 'neg-auth-exec'
    mockSocket.request = {
      session: { save: mock.fn((cb) => cb()), sshCredentials: null, usedBasicAuth: false, envVars: null },
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
      async shell() { const s = new EventEmitter(); s.write = () => {}; return s }
      async exec(_cmd, options, env) {
        capturedOptions = options
        capturedEnv = env
        const s = new EventEmitter()
        s.stderr = new EventEmitter()
        process.nextTick(() => {
          s.emit('data', Buffer.from('OUT'))
          s.stderr.emit('data', Buffer.from('ERR'))
          s.emit('close', 0, null)
        })
        return s
      }
      end() {}
    }
    MockSSHConnection = SSH

    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('authenticate: string port and missing secrets → invalid credentials', () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    onConn(mockSocket)
    mockSocket.emit = mock.fn()

    // Port provided as string, no password/privateKey
    EventEmitter.prototype.emit.call(mockSocket, 'authenticate', {
      username: 'u', host: 'h', port: '22'
    })

    const authEvents = mockSocket.emit.mock.calls.filter((c) => c.arguments[0] === 'authentication')
    assert.ok(authEvents.length > 0)
    const last = authEvents[authEvents.length - 1].arguments[1]
    assert.equal(last.success, false)
  })

  it('connection: interactive auth disabled → emits ssherror and disconnects', () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    mockConfig.ssh.disableInteractiveAuth = true
    onConn(mockSocket)
    const ssherr = mockSocket.emit.mock.calls.find((c) => c.arguments[0] === 'ssherror')
    assert.ok(ssherr, 'ssherror emitted')
    assert.equal(mockSocket.disconnect.mock.calls.length, 1, 'disconnect called')
  })

  it('exec: non-object env ignored for strings; arrays become numeric-key objects', async () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    onConn(mockSocket)
    await new Promise((r) => setImmediate(r))

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'ls', env: 'BAD' })
    await new Promise((r) => setImmediate(r))
    assert.deepEqual(capturedEnv, {}, 'string env ignored -> {}')

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'ls', env: ['BAD'] })
    await new Promise((r) => setImmediate(r))
    assert.equal(capturedEnv['0'], 'BAD', 'array merged as {0: "BAD"}')
  })

  it('exec: merges only object env properties', async () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    mockSocket.request.session.envVars = { BASE: '1' }
    onConn(mockSocket)
    await new Promise((r) => setImmediate(r))

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'env', env: { EXTRA: '2' } })
    await new Promise((r) => setImmediate(r))
    assert.equal(capturedEnv.BASE, '1')
    assert.equal(capturedEnv.EXTRA, '2')
  })
})
