import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket.js'
import { 
  createMockIO, 
  createMockSocket, 
  createMockSSHConnection, 
  createMockSocketConfig 
} from '../test-helpers.js'

describe('Socket.IO Contracts', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket()
    mockConfig = createMockSocketConfig()
    MockSSHConnection = createMockSSHConnection({ withExecMethods: true })

    socketHandler(io, mockConfig, MockSSHConnection)
  })

  it('emits authentication(request_auth) on new connection without basic auth', () => {
    const connectionHandler = (io.on as any).mock.calls[0].arguments[1]
    connectionHandler(mockSocket)
    const [event, payload] = (mockSocket.emit as any).mock.calls[0].arguments
    assert.equal(event, 'authentication')
    assert.deepEqual(payload, { action: 'request_auth' })
  })

  it('emits explicit failure when authenticate payload invalid', () => {
    const connectionHandler = (io.on as any).mock.calls[0].arguments[1]
    connectionHandler(mockSocket)
    // reset emitted calls by reassigning a fresh spy
    mockSocket.emit = mock.fn()
    EventEmitter.prototype.emit.call(mockSocket, 'authenticate', { host: 'h' })
    const authEvents = (mockSocket.emit as any).mock.calls.filter((c: any) => c.arguments[0] === 'authentication')
    assert.ok(authEvents.length > 0)
    const last = authEvents[authEvents.length - 1].arguments[1]
    assert.equal(last.success, false)
    assert.match(String(last.message || ''), /Invalid credentials/i)
  })

  it('emits permissions after successful connection with expected flags', async () => {
    const connectionHandler = (io.on as any).mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = { host: 'h', port: 22, username: 'u', password: 'p' }
    connectionHandler(mockSocket)
    await new Promise((r) => setImmediate(r))
    const permEvent = (mockSocket.emit as any).mock.calls.find((c: any) => c.arguments[0] === 'permissions')
    assert.ok(permEvent, 'permissions event emitted')
    const perms = permEvent.arguments[1]
    assert.deepEqual(Object.keys(perms).sort(), ['allowReauth', 'allowReconnect', 'allowReplay', 'autoLog'].sort())
  })
})