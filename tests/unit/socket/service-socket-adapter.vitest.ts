import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Socket } from 'socket.io'
import type { Services } from '../../../app/services/interfaces.js'
import type { UnifiedAuthPipeline } from '../../../app/auth/auth-pipeline.js'
import type { AdapterContext } from '../../../app/socket/adapters/service-socket-shared.js'
import type { Config } from '../../../app/types/config.js'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from '../../../app/types/contracts/v1/socket.js'
import type { LogLevel } from '../../../app/logging/levels.js'
import type { LogEventName } from '../../../app/logging/event-catalog.js'
import type { SocketLogOptions } from '../../../app/logging/socket-logger.js'
import {
  TEST_NETWORK,
  TEST_SECRET,
  TEST_USER_AGENTS,
  TEST_SOCKET_CONSTANTS
} from '../../test-constants.js'
import { DEFAULT_AUTH_METHODS } from '../../../app/constants/index.js'
import { createAuthMethod } from '../../../app/types/branded.js'

type EmitSocketLogArgs = [
  AdapterContext,
  LogLevel,
  LogEventName,
  string,
  SocketLogOptions | undefined
]

const emitSocketLogMock = vi.fn<EmitSocketLogArgs, void>()

const {
  REMOTE_PASSWORD_HEADER,
  SESSION_CREDENTIALS_KEY,
  PASSWORD_SOURCE_NONE,
  SSO_PASSWORD_HEADER
} = TEST_SOCKET_CONSTANTS

const ensureSocket = (context: AdapterContext): Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> => {
  return context.socket
}

vi.mock('../../../app/logging/socket-logger.js', () => ({
  emitSocketLog: (...args: EmitSocketLogArgs) => {
    emitSocketLogMock(...args)
  }
}))

class StubAuthPipeline implements Partial<UnifiedAuthPipeline> {
  isAuthenticated(): boolean {
    return false
  }

  requiresAuthRequest(): boolean {
    return false
  }
}

vi.mock('../../../app/auth/auth-pipeline.js', () => ({
  // Use function syntax for Vitest 4.0 constructor mock compatibility
  UnifiedAuthPipeline: vi.fn(function(_request: unknown, _config: unknown) {
    return new StubAuthPipeline()
  })
}))

vi.mock('../../../app/socket/adapters/service-socket-authentication.js', () => ({
  ServiceSocketAuthentication: class {
    constructor(private readonly context: AdapterContext) {}

    checkInitialAuth(): void {
      ensureSocket(this.context)
    }
  }
}))

vi.mock('../../../app/socket/adapters/service-socket-terminal.js', () => ({
  ServiceSocketTerminal: class {
    constructor(private readonly context: AdapterContext) {}

    handleTerminal(): void {
      ensureSocket(this.context)
    }

    handleResize(): void {
      ensureSocket(this.context)
    }

    handleData(): void {
      ensureSocket(this.context)
    }

    handleExec(): void {
      ensureSocket(this.context)
    }
  }
}))

vi.mock('../../../app/socket/adapters/service-socket-control.js', () => ({
  ServiceSocketControl: class {
    constructor(private readonly context: AdapterContext) {}

    handleControl(): void {
      ensureSocket(this.context)
    }

    handleDisconnect(): void {
      ensureSocket(this.context)
    }
  }
}))

const createConfig = (): Config => ({
  listen: { ip: '0.0.0.0', port: 2222 },
  http: { origins: [] },
  user: {
    name: null,
    password: null,
    privateKey: null,
    passphrase: null
  },
  ssh: {
    host: null,
    port: 22,
    term: 'xterm-256color',
    readyTimeout: 20000,
    keepaliveInterval: 30000,
    keepaliveCountMax: 3,
    disableInteractiveAuth: false,
    alwaysSendKeyboardInteractivePrompts: false,
    algorithms: {
      cipher: [],
      compress: [],
      hmac: [],
      kex: [],
      serverHostKey: []
    },
    allowedAuthMethods: DEFAULT_AUTH_METHODS.map(createAuthMethod),
    hostKeyVerification: {
      enabled: false,
      mode: 'hybrid' as const,
      unknownKeyAction: 'prompt' as const,
      serverStore: {
        enabled: true,
        dbPath: '/data/hostkeys.db',
      },
      clientStore: {
        enabled: true,
      },
    }
  },
  header: {
    text: null,
    background: '#000000'
  },
  options: {
    allowReplay: true,
    allowReauth: true,
    allowReconnect: true,
    autoLog: false
  },
  session: {
    secret: TEST_SECRET,
    name: 'test-session'
  },
  sso: {
    enabled: false,
    csrfProtection: false,
    trustedProxies: [],
    headerMapping: {
      username: 'x-user',
      password: SSO_PASSWORD_HEADER,
      session: 'x-session'
    }
  }
})

type TestSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

const createSocket = (): TestSocket => {
  const headers = {
    'user-agent': TEST_USER_AGENTS.SERVICE_SOCKET,
    'x-forwarded-for': TEST_NETWORK.FORWARDED_IP,
    'x-forwarded-port': String(TEST_NETWORK.FORWARDED_PORT),
    [REMOTE_PASSWORD_HEADER]: SESSION_CREDENTIALS_KEY
  }

  const socket: Partial<TestSocket> = {
    id: 'socket-123',
    handshake: {
      headers,
      address: TEST_NETWORK.HANDSHAKE_IP
    },
    request: {
      headers,
      session: { [SESSION_CREDENTIALS_KEY]: { passwordSource: PASSWORD_SOURCE_NONE } }
    },
    on: vi.fn(),
    onAny: vi.fn(),
    emit: vi.fn()
  }

  return socket as TestSocket
}

describe('ServiceSocketAdapter', () => {
  beforeEach(() => {
    emitSocketLogMock.mockClear()
  })

  it('emits session_init with client metadata on construction', async () => {
    const { ServiceSocketAdapter } = await import('../../../app/socket/adapters/service-socket-adapter.js')

    const socket = createSocket()
    const config = createConfig()
    const services = {} as Services

    const adapter = new ServiceSocketAdapter(socket, config, services)

    expect(adapter).toBeInstanceOf(ServiceSocketAdapter)

    expect(emitSocketLogMock).toHaveBeenCalled()
    const callArgs: EmitSocketLogArgs = emitSocketLogMock.mock.calls[0]
    const [context, level, event, message, options] = callArgs

    expect(level).toBe('info')
    expect(event).toBe('session_init')
    expect(message).toBe('Socket session initialised')

    expect(context.state.clientIp).toBe(TEST_NETWORK.FORWARDED_IP)
    expect(context.state.clientPort).toBe(TEST_NETWORK.FORWARDED_PORT)
    expect(context.state.clientSourcePort).toBe(TEST_NETWORK.FORWARDED_PORT)
    expect(context.state.userAgent).toBe(TEST_USER_AGENTS.SERVICE_SOCKET)

    expect(options?.data).toMatchObject({
      allow_replay: true,
      allow_reauth: true,
      allow_reconnect: true
    })
  })

  it('emits permissions with hostKeyVerification on construction', async () => {
    const { ServiceSocketAdapter } = await import('../../../app/socket/adapters/service-socket-adapter.js')

    const socket = createSocket()
    const config = createConfig()
    const services = {} as Services

    void new ServiceSocketAdapter(socket, config, services)

    expect(socket.emit).toHaveBeenCalledWith('permissions', {
      hostKeyVerification: {
        enabled: false,
        clientStoreEnabled: true,
        unknownKeyAction: 'prompt',
      },
    })
  })

  it('emits permissions before auth check (verify emit order)', async () => {
    const { ServiceSocketAdapter } = await import('../../../app/socket/adapters/service-socket-adapter.js')

    const socket = createSocket()
    const config = createConfig()
    config.ssh.hostKeyVerification.enabled = true
    const services = {} as Services

    void new ServiceSocketAdapter(socket, config, services)

    expect(socket.emit).toHaveBeenCalledWith('permissions', {
      hostKeyVerification: {
        enabled: true,
        clientStoreEnabled: true,
        unknownKeyAction: 'prompt',
      },
    })
  })
})
