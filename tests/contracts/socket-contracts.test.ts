import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import socketHandler from '../../dist/app/socket-v2.js'
import {
  createMockIO,
  createMockSocket,
  createMockSSHConnection,
  createMockSocketConfig
} from '../test-utils.js'
import { MOCK_CREDENTIALS } from '../test-constants.js'

// Mock types for socket testing
interface MockIOCall {
  arguments: [string, (...args: unknown[]) => void]
}

interface MockSocketCall {
  arguments: [string, unknown]
}

interface MockIO {
  on: {
    mock: {
      calls: MockIOCall[]
    }
  }
}

interface MockSocket extends EventEmitter {
  emit: {
    mock: {
      calls: MockSocketCall[]
    }
  }
  request: {
    session: {
      usedBasicAuth?: boolean
      sshCredentials?: unknown
    }
  }
}

void describe('Socket.IO Contracts', () => {
  let io: MockIO, mockSocket: MockSocket, mockConfig: unknown, MockSSHConnection: unknown

  beforeEach(() => {
    io = createMockIO() as MockIO
    mockSocket = createMockSocket() as MockSocket
    mockConfig = createMockSocketConfig()
    MockSSHConnection = createMockSSHConnection({ withExecMethods: true })

    socketHandler(io, mockConfig, MockSSHConnection)
  })

  void it('emits authentication(request_auth) on new connection without basic auth', () => {
    const connectionHandler = io.on.mock.calls[0].arguments[1]
    connectionHandler(mockSocket)
    const [event, payload] = mockSocket.emit.mock.calls[0].arguments
    assert.equal(event, 'authentication')
    assert.deepEqual(payload, { action: 'request_auth' })
  })

  void it('emits explicit failure when authenticate payload invalid', () => {
    const connectionHandler = io.on.mock.calls[0].arguments[1]
    connectionHandler(mockSocket)
    // reset emitted calls by reassigning a fresh spy
    mockSocket.emit = mock.fn() as MockSocket['emit']
    EventEmitter.prototype.emit.call(mockSocket, 'authenticate', { host: 'h' })
    const authEvents = mockSocket.emit.mock.calls.filter((c) => c.arguments[0] === 'authentication')
    assert.ok(authEvents.length > 0)
    const last = authEvents[authEvents.length - 1].arguments[1] as { success?: boolean; message?: string }
    assert.equal(last.success, false)
    assert.match(String(last.message ?? ''), /Invalid credentials/i)
  })

  void it('emits permissions after successful connection with expected flags', async () => {
    const connectionHandler = io.on.mock.calls[0].arguments[1]
    mockSocket.request.session.usedBasicAuth = true
    mockSocket.request.session.sshCredentials = MOCK_CREDENTIALS.basic
    connectionHandler(mockSocket)
    await new Promise<void>((r) => setImmediate(r))
    const permEvent = mockSocket.emit.mock.calls.find((c) => c.arguments[0] === 'permissions')
    assert.ok(permEvent !== undefined, 'permissions event emitted')
    const perms = permEvent.arguments[1] as Record<string, unknown>
    assert.deepEqual(Object.keys(perms).sort(), ['allowReauth', 'allowReconnect', 'allowReplay', 'autoLog'].sort())
  })
})