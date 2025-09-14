import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../dist/app/socket.js'
import type { Socket } from 'socket.io'

describe('Socket Handler', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any

  beforeEach(() => {
    // Mock Socket.IO instance
    io = new EventEmitter()
    io.on = mock.fn(io.on)

    // Mock socket instance
    mockSocket = new EventEmitter()
    mockSocket.id = 'test-socket-id'
    mockSocket.request = {
      session: {
        save: mock.fn((cb: () => void) => cb()),
        sshCredentials: null,
        usedBasicAuth: false
      },
    }
    mockSocket.emit = mock.fn()
    mockSocket.disconnect = mock.fn()

    // Mock config
    mockConfig = {
      ssh: {
        term: 'xterm-color',
        readyTimeout: 20000,
        keepaliveInterval: 120000,
        keepaliveCountMax: 10,
        disableInteractiveAuth: false,
      },
      options: {
        allowReauth: true,
        allowReplay: true,
        allowReconnect: true,
      },
      user: {},
      header: null,
    }

    // Mock SSH Connection class
    MockSSHConnection = class extends EventEmitter {
      connect() {
        return Promise.resolve()
      }
      shell() {
        return Promise.resolve(new EventEmitter())
      }
      exec(command: string, options: any, envVars: any) {
        const stream: any = new EventEmitter()
        // rudimentary stderr emitter
        stream.stderr = new EventEmitter()
        // simulate async behavior
        process.nextTick(() => {
          stream.emit('data', Buffer.from(`OUT:${command}`))
          stream.stderr.emit('data', Buffer.from('ERR:warn'))
          stream.emit('close', 0, null)
        })
        return Promise.resolve(stream)
      }
      end() {}
    }

    // Initialize socket handler
    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('should set up connection listener on io instance', () => {
    assert.equal((io.on as any).mock.calls.length, 1)
    assert.equal((io.on as any).mock.calls[0].arguments[0], 'connection')
    assert.equal(typeof (io.on as any).mock.calls[0].arguments[1], 'function')
  })

  it('should create new WebSSH2Socket instance on connection', () => {
    const connectionHandler = (io.on as any).mock.calls[0].arguments[1]
    connectionHandler(mockSocket)

    // Verify socket emits authentication request when no basic auth
    assert.equal((mockSocket.emit as any).mock.calls[0].arguments[0], 'authentication')
    assert.deepEqual((mockSocket.emit as any).mock.calls[0].arguments[1], {
      action: 'request_auth',
    })
  })

  it('should handle exec requests and emit typed output and exit', async () => {
    const connectionHandler = (io.on as any).mock.calls[0].arguments[1]

    // Configure session to auto-authenticate on connect
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = {
      host: 'localhost',
      port: 22,
      username: 'user',
      password: 'pass',
    }

    connectionHandler(mockSocket)

    // Wait until auth_result is emitted to ensure ssh is initialized
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    // After authentication success, emit an exec request
    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'echo 123' })
    await new Promise((resolve) => setImmediate(resolve))

    // Collect emitted events
    const events = (mockSocket.emit as any).mock.calls.map((c: any) => c.arguments[0])
    assert.ok(events.includes('data'), 'should emit stdout on data channel')
    assert.ok(events.includes('exec-data'), 'should emit typed exec-data')
    assert.ok(events.includes('exec-exit'), 'should emit exec-exit on completion')

    // Verify typed payloads
    const typedPayloads = (mockSocket.emit as any).mock.calls
      .filter((c: any) => c.arguments[0] === 'exec-data')
      .map((c: any) => c.arguments[1])
    assert.ok(
      typedPayloads.some((p: any) => p?.type === 'stdout' && /OUT:echo 123/.test(p?.data)),
      'stdout typed payload present'
    )
    assert.ok(
      typedPayloads.some((p: any) => p?.type === 'stderr' && /ERR:warn/.test(p?.data)),
      'stderr typed payload present'
    )

    const exitPayloads = (mockSocket.emit as any).mock.calls
      .filter((c: any) => c.arguments[0] === 'exec-exit')
      .map((c: any) => c.arguments[1])
    assert.equal(exitPayloads[0]?.code, 0)
  })

  it('should emit error when exec payload is invalid', async () => {
    const connectionHandler = (io.on as any).mock.calls[0].arguments[1]

    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = {
      host: 'localhost',
      port: 22,
      username: 'user',
      password: 'pass',
    }

    connectionHandler(mockSocket)
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { })
    await new Promise((resolve) => setImmediate(resolve))

    const ssherrorEmits = (mockSocket.emit as any).mock.calls.filter((c: any) => c.arguments[0] === 'ssherror')
    assert.ok(ssherrorEmits.length > 0, 'should emit ssherror for invalid payload')
  })
})

describe('Authentication Flow', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any

  beforeEach(() => {
    // Mock Socket.IO instance
    io = new EventEmitter()
    io.on = mock.fn(io.on)

    // Mock socket instance
    mockSocket = new EventEmitter()
    mockSocket.id = 'test-socket-id'
    mockSocket.request = {
      session: {
        save: mock.fn((cb: () => void) => cb()),
        sshCredentials: null,
        usedBasicAuth: false
      },
    }
    mockSocket.emit = mock.fn()
    mockSocket.disconnect = mock.fn()

    // Mock config
    mockConfig = {
      ssh: {
        term: 'xterm-color',
        readyTimeout: 20000,
        keepaliveInterval: 120000,
        keepaliveCountMax: 10,
        disableInteractiveAuth: false,
      },
      options: {
        allowReauth: true,
      },
      user: {},
      header: null,
    }

    // Mock SSH Connection class
    MockSSHConnection = class extends EventEmitter {}

    // Initialize socket handler
    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('should disconnect client when no credentials available', () => {
    const connectionHandler = (io.on as any).mock.calls[0].arguments[1]
    connectionHandler(mockSocket)

    // When client has no pre-existing credentials, it should request auth
    assert.equal((mockSocket.emit as any).mock.calls[0].arguments[0], 'authentication')
    assert.deepEqual((mockSocket.emit as any).mock.calls[0].arguments[1], {
      action: 'request_auth',
    })
  })
})