import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket.js'

describe('Socket.IO Contracts', () => {
  let io, mockSocket, mockConfig, MockSSHConnection

  beforeEach(() => {
    io = new EventEmitter()
    io.on = mock.fn(io.on)

    mockSocket = new EventEmitter()
    mockSocket.id = 'test-socket-id'
    mockSocket.request = {
      session: { save: mock.fn((cb) => cb()), sshCredentials: null, usedBasicAuth: false },
    }
    mockSocket.emit = mock.fn()
    mockSocket.disconnect = mock.fn()

    mockConfig = {
      ssh: { term: 'xterm-color', disableInteractiveAuth: false },
      options: { allowReauth: true, allowReplay: true, allowReconnect: true },
      user: {},
      header: null,
    }

    MockSSHConnection = class extends EventEmitter {
      connect() { return Promise.resolve() }
      shell() { return Promise.resolve(new EventEmitter()) }
      exec() { return Promise.resolve(new EventEmitter()) }
      end() {}
    }

    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('emits authentication(request_auth) on new connection without basic auth', () => {
    const connectionHandler = io.on.mock.calls[0].arguments[1]
    connectionHandler(mockSocket)
    const [event, payload] = mockSocket.emit.mock.calls[0].arguments
    assert.equal(event, 'authentication')
    assert.deepEqual(payload, { action: 'request_auth' })
  })

  it('emits explicit failure when authenticate payload invalid', () => {
    const connectionHandler = io.on.mock.calls[0].arguments[1]
    connectionHandler(mockSocket)
    // reset emitted calls by reassigning a fresh spy
    mockSocket.emit = mock.fn()
    EventEmitter.prototype.emit.call(mockSocket, 'authenticate', { host: 'h' })
    const authEvents = mockSocket.emit.mock.calls.filter((c) => c.arguments[0] === 'authentication')
    assert.ok(authEvents.length > 0)
    const last = authEvents[authEvents.length - 1].arguments[1]
    assert.equal(last.success, false)
    assert.match(String(last.message || ''), /Invalid credentials/i)
  })

  it('emits permissions after successful connection with expected flags', async () => {
    const connectionHandler = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    connectionHandler(mockSocket)
    await new Promise((r) => setImmediate(r))
    const permEvent = mockSocket.emit.mock.calls.find((c) => c.arguments[0] === 'permissions')
    assert.ok(permEvent, 'permissions event emitted')
    const perms = permEvent.arguments[1]
    assert.deepEqual(Object.keys(perms).sort(), ['allowReauth', 'allowReconnect', 'allowReplay', 'autoLog'].sort())
  })
})
