import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../dist/app/socket.js'
import { 
  createMockIO, 
  createMockSocket, 
  createMockSSHConnection, 
  createMockSocketConfig 
} from './test-helpers.js'
import { TEST_PASSWORDS } from './test-constants.js'

describe('Socket Handler', () => {
  let io: any, mockSocket: any, mockConfig: any, MockSSHConnection: any

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket()
    mockConfig = createMockSocketConfig()
    MockSSHConnection = createMockSSHConnection({ withExecMethods: true })
    
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
    mockSocket = createMockSocket({
      usedBasicAuth: true,
      sessionCredentials: {
        host: 'localhost',
        port: 22,
        username: 'user',
        password: TEST_PASSWORDS.basic,
      }
    })

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

    mockSocket = createMockSocket({
      usedBasicAuth: true,
      sessionCredentials: {
        host: 'localhost',
        port: 22,
        username: 'user',
        password: TEST_PASSWORDS.basic,
      }
    })

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
  let io: any, mockSocket: any

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket()
    const mockConfig = createMockSocketConfig()
    const MockSSHConnection = createMockSSHConnection({ withExecMethods: false })
    
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