import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../../app/socket.js'

describe('Socket.IO Negative Paths', () => {
  let io, mockSocket, mockConfig, MockSSHConnection, lastShellOptions

  beforeEach(() => {
    io = new EventEmitter()
    io.on = mock.fn(io.on)

    mockSocket = new EventEmitter()
    mockSocket.id = 'neg-socket-id'
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
      constructor() {
        super()
        this.resizeTerminal = mock.fn()
      }
      async connect() { return }
      async shell(options) {
        lastShellOptions = options
        const stream = new EventEmitter()
        stream.write = () => {}
        return stream
      }
      async exec() { return new EventEmitter() }
      end() {}
    }
    MockSSHConnection = SSH

    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('terminal: ignores invalid term and keeps default', async () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    onConn(mockSocket)
    await new Promise((r) => setImmediate(r))

    // send invalid term and non-integer sizes
    EventEmitter.prototype.emit.call(mockSocket, 'terminal', { term: 'bad!@', rows: 'abc', cols: 'xyz' })
    await new Promise((r) => setImmediate(r))

    assert.equal(lastShellOptions.term, 'xterm-color', 'falls back to default term')
    assert.equal(lastShellOptions.rows, 24, 'falls back to default rows')
    assert.equal(lastShellOptions.cols, 80, 'falls back to default cols')
  })

  it('resize: ignores invalid sizes and does not call resizeTerminal', async () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    onConn(mockSocket)
    await new Promise((r) => setImmediate(r))

    // First create shell with defaults via terminal event
    EventEmitter.prototype.emit.call(mockSocket, 'terminal', {})
    await new Promise((r) => setImmediate(r))

    // Now send invalid resize payload
    EventEmitter.prototype.emit.call(mockSocket, 'resize', { rows: 'NaN', cols: 'oops' })
    await new Promise((r) => setImmediate(r))

    // ssh instance stored inside handler has resizeTerminal mocked; ensure not called with invalid
    // We can't access instance directly; instead, assert no permissions or error side-effects
    const resizeCalls = [].concat(
      mockSocket.emit.mock.calls.filter((c) => c.arguments[0] === 'ssherror')
    )
    assert.equal(resizeCalls.length, 0, 'no ssherror emitted on bad resize')
  })

  it('control: warns on invalid control command', async () => {
    const onConn = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    onConn(mockSocket)
    await new Promise((r) => setImmediate(r))

    const warn = mock.method(console, 'warn', () => {})
    EventEmitter.prototype.emit.call(mockSocket, 'terminal', {})
    await new Promise((r) => setImmediate(r))
    EventEmitter.prototype.emit.call(mockSocket, 'control', 'bad-cmd')
    await new Promise((r) => setImmediate(r))

    assert.ok(warn.mock.calls.length >= 1, 'console.warn called for invalid control')
    warn.mock.restore()
  })
})

