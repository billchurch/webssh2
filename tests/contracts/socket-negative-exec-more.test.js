import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket.js'

describe('Socket.IO Negative: exec edge cases', () => {
  let io, mockSocket, mockConfig, MockSSHConnection, capturedOptions, execExitPayload

  beforeEach(() => {
    io = new EventEmitter()
    io.on = mock.fn(io.on)

    mockSocket = new EventEmitter()
    mockSocket.id = 'neg-exec-more'
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
      async exec(_cmd, options) {
        capturedOptions = options
        const s = new EventEmitter()
        s.stderr = new EventEmitter()
        process.nextTick(() => {
          s.emit('data', Buffer.from('X'))
          s.stderr.emit('data', Buffer.from('E'))
          s.emit('close', 0, null)
        })
        return s
      }
      end() {}
    }
    MockSSHConnection = SSH

    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('exec: non-string command → ssherror', async () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    onConn(mockSocket)
    await new Promise((r) => setImmediate(r))

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 42 })
    await new Promise((r) => setImmediate(r))
    const err = mockSocket.emit.mock.calls.find((c) => c.arguments[0] === 'ssherror')
    assert.ok(err, 'ssherror emitted for non-string command')
  })

  it('exec: invalid timeoutMs ignored (negative or string)', async () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    onConn(mockSocket)
    await new Promise((r) => setImmediate(r))

    mockSocket.emit = mock.fn()
    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'ls', timeoutMs: -100 })
    await new Promise((r) => setImmediate(r))
    const exit1 = mockSocket.emit.mock.calls.find((c) => c.arguments[0] === 'exec-exit')
    assert.ok(exit1, 'exec-exit emitted without TIMEOUT for negative timeout')
    assert.notEqual(exit1.arguments[1]?.signal, 'TIMEOUT')

    mockSocket.emit = mock.fn()
    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'ls', timeoutMs: 'abc' })
    await new Promise((r) => setImmediate(r))
    const exit2 = mockSocket.emit.mock.calls.find((c) => c.arguments[0] === 'exec-exit')
    assert.ok(exit2, 'exec-exit emitted without TIMEOUT for string timeout')
    assert.notEqual(exit2.arguments[1]?.signal, 'TIMEOUT')
  })

  it('exec: huge or negative cols/rows do not crash and pass through', async () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    onConn(mockSocket)
    await new Promise((r) => setImmediate(r))

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'ls', cols: 100000, rows: 50000 })
    await new Promise((r) => setImmediate(r))
    assert.equal(capturedOptions.cols, 100000)
    assert.equal(capturedOptions.rows, 50000)

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'ls', cols: -5, rows: 0 })
    await new Promise((r) => setImmediate(r))
    assert.equal(capturedOptions.cols, -5)
    // rows=0 falls back via falsy check to default 24
    assert.equal(capturedOptions.rows, 24)
  })
})
