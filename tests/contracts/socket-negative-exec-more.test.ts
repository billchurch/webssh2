import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket.js'
import { MOCK_CREDENTIALS } from '../test-constants.js'

describe('Socket.IO Negative: exec edge cases', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any, capturedOptions: any

  beforeEach(() => {
    io = new EventEmitter()
    io.on = mock.fn(io.on)

    mockSocket = new EventEmitter()
    mockSocket.id = 'neg-exec-more'
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
      async exec(_cmd: string, _options: any) {
        const s: any = new EventEmitter()
        s.stderr = new EventEmitter()
        process.nextTick(() => {
          s.emit('data', Buffer.from('X'))
          s.stderr.emit('data', Buffer.from('E'))
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

  it('exec: non-string command → ssherror', async () => {
    const onConn = (io.on as any).mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
    onConn(mockSocket)

    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 123 })
    await new Promise((r) => setImmediate(r))

    const ssherrorEmits = (mockSocket.emit as any).mock.calls.filter((c: any) => c.arguments[0] === 'ssherror')
    assert.ok(ssherrorEmits.length > 0, 'ssherror emitted for non-string command')
  })

  it('exec: exit payload contains code and signal', async () => {
    const onConn = (io.on as any).mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
    onConn(mockSocket)

    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))

    EventEmitter.prototype.emit.call(mockSocket, 'exec', { command: 'test' })
    await new Promise((r) => setImmediate(r))

    const exitEmits = (mockSocket.emit as any).mock.calls.filter((c: any) => c.arguments[0] === 'exec-exit')
    assert.ok(exitEmits.length > 0, 'exec-exit emitted')
    const exitPayload = exitEmits[0].arguments[1]
    assert.equal(exitPayload.code, 0)
    assert.equal(exitPayload.signal, null)
  })
})