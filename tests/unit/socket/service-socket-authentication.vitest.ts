import { describe, expect, it, vi } from 'vitest'
import { ServiceSocketAuthentication } from '../../../app/socket/adapters/service-socket-authentication.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from '../../../app/socket/adapters/service-socket-shared.js'
import { SOCKET_EVENTS } from '../../../app/constants/socket-events.js'
import { createMockDependencies, createMockSocketConfig, createMockServices, createStructuredLoggerStub } from '../../test-utils.js'
import type { Config } from '../../../app/types/config.js'
import type { AuthResult, Services } from '../../../app/services/interfaces.js'
import type { UnifiedAuthPipeline } from '../../../app/auth/auth-pipeline.js'
import { createAuthMethod, type SessionId } from '../../../app/types/branded.js'
import { AUTH_METHOD_TOKENS } from '../../../app/constants/index.js'
import type { AuthCredentials } from '../../../app/types/contracts/v1/socket.js'
import { ServiceSocketControl } from '../../../app/socket/adapters/service-socket-control.js'
import { AuthServiceImpl } from '../../../app/services/auth/auth-service.js'
import { SessionServiceImpl } from '../../../app/services/session/session-service.js'
import { TerminalServiceImpl } from '../../../app/services/terminal/terminal-service.js'
import { SessionStore } from '../../../app/state/store.js'
import { TEST_PASSWORD, TEST_SSH, TEST_USERNAME } from '../../test-constants.js'

const createStubPipeline = (): { pipeline: UnifiedAuthPipeline; store: Record<string, unknown> } => {
  let storedCredentials: Record<string, unknown> | null = null

  const pipeline: Partial<UnifiedAuthPipeline> = {
    getAuthMethod: vi.fn(() => 'manual'),
    isAuthenticated: vi.fn(() => false),
    requiresAuthRequest: vi.fn(() => true),
    setManualCredentials: vi.fn((creds: Record<string, unknown>) => {
      storedCredentials = creds
      return true
    }),
    getCredentials: vi.fn(() => storedCredentials)
  }

  return { pipeline: pipeline as UnifiedAuthPipeline, store: { get: () => storedCredentials } }
}

const createBaseContext = (config: Config, services: Services, pipeline: UnifiedAuthPipeline): AdapterContext => {
  const socket = {
    id: 'socket-1',
    emit: vi.fn(),
    request: {
      session: {
        save: vi.fn((cb: () => void) => cb()),
        sshCredentials: null,
        usedBasicAuth: false,
        envVars: null
      }
    }
  } as unknown as AdapterContext['socket']

  return {
    socket,
    config,
    services,
    authPipeline: pipeline,
    state: createAdapterSharedState(),
    protocol: 'ssh',
    debug: vi.fn(),
    logger: createStructuredLoggerStub()
  }
}

describe('ServiceSocketAuthentication - auth method policy', () => {
  const credentials: AuthCredentials = {
    username: 'tester',
    host: 'localhost',
    port: 22,
    password: 'secret'
  }

  it('emits policy violation when password auth disabled', async () => {
    const config = createMockSocketConfig({
      ssh: {
        allowedAuthMethods: [createAuthMethod(AUTH_METHOD_TOKENS.PUBLIC_KEY)]
      }
    }) as Config

    const services = createMockServices({ authSucceeds: true, sshConnectSucceeds: true }) as Services
    const { pipeline } = createStubPipeline()
    const context = createBaseContext(config, services, pipeline)

    const auth = new ServiceSocketAuthentication(context)

    await auth.handleAuthentication(credentials)

    const sshAuthFailureCalls = vi.mocked(context.socket.emit).mock.calls.filter(
      ([event]) => event === SOCKET_EVENTS.SSH_AUTH_FAILURE
    )
    expect(sshAuthFailureCalls.length).toBeGreaterThan(0)
    const lastFailureEvent = sshAuthFailureCalls.at(-1)
    if (lastFailureEvent === undefined) {
      throw new Error('Expected SSH auth failure event')
    }
    const payload = lastFailureEvent[1] as { error: string; method: string }
    expect(payload).toEqual({
      error: 'auth_method_disabled',
      method: 'password'
    })
    expect(services.auth.authenticate).not.toHaveBeenCalled()
    expect(services.ssh.connect).not.toHaveBeenCalled()
  })

  it('allows authentication when method permitted', async () => {
    const config = createMockSocketConfig() as Config
    const services = createMockServices({ authSucceeds: true, sshConnectSucceeds: true }) as Services
    const { pipeline } = createStubPipeline()
    const context = createBaseContext(config, services, pipeline)

    const auth = new ServiceSocketAuthentication(context)

    await auth.handleAuthentication(credentials)

    expect(services.auth.authenticate).toHaveBeenCalledTimes(1)
    expect(services.ssh.connect).toHaveBeenCalledTimes(1)
    const authEvents = vi.mocked(context.socket.emit).mock.calls.filter(
      ([event]) => event === SOCKET_EVENTS.AUTHENTICATION
    )
    const lastAuthEvent = authEvents.at(-1)
    if (lastAuthEvent === undefined) {
      throw new Error('Expected authentication event')
    }
    const lastAuthPayload = lastAuthEvent[1] as { success: boolean }
    expect(lastAuthPayload.success).toBe(true)
  })
})

const createLifecycleContext = (): {
  auth: ServiceSocketAuthentication
  control: ServiceSocketControl
  context: AdapterContext
  store: SessionStore
  authService: AuthServiceImpl
  issued: SessionId[]
} => {
  const deps = createMockDependencies()
  const store = new SessionStore()
  const authService = new AuthServiceImpl(deps, store)
  const issued: SessionId[] = []
  const authenticate = authService.authenticate.bind(authService)
  vi.spyOn(authService, 'authenticate').mockImplementation(async creds => {
    const result = await authenticate(creds)
    if (result.ok) {
      issued.push(result.value.sessionId)
    }
    return result
  })

  const mocks = createMockServices({ sshConnectSucceeds: true }) as Services
  const services = {
    ...mocks,
    auth: authService,
    session: new SessionServiceImpl(deps, store),
    terminal: new TerminalServiceImpl(deps, store),
    sftp: { cancelSessionTransfers: vi.fn(), closeSession: vi.fn() }
  } as unknown as Services

  const { pipeline } = createStubPipeline()
  const context = createBaseContext(createMockSocketConfig() as Config, services, pipeline)
  return {
    auth: new ServiceSocketAuthentication(context),
    control: new ServiceSocketControl(context),
    context,
    store,
    authService,
    issued
  }
}

const sessionInfo = (authService: AuthServiceImpl, sessionId: SessionId): AuthResult | null => {
  const info = authService.getSessionInfo(sessionId)
  return info.ok ? info.value : null
}

describe('ServiceSocketAuthentication - session lifecycle', () => {
  const credentials: AuthCredentials = {
    username: TEST_USERNAME,
    host: TEST_SSH.HOST,
    port: TEST_SSH.PORT,
    password: TEST_PASSWORD
  }

  it('releases the session issued by a failed connection attempt', async () => {
    const { auth, control, context, store, authService, issued } = createLifecycleContext()
    vi.mocked(context.services.ssh.connect).mockResolvedValue({
      ok: false,
      error: new Error('SSH connection failed')
    })

    for (let attempt = 0; attempt < 25; attempt++) {
      await auth.handleAuthentication(credentials)
    }

    expect(issued).toHaveLength(25)
    expect(store.getSessionIds()).toHaveLength(0)
    for (const sessionId of issued) {
      expect(sessionInfo(authService, sessionId)).toBeNull()
    }

    control.handleDisconnect()
    expect(store.getSessionIds()).toHaveLength(0)
  })

  it('releases the session issued when authentication throws', async () => {
    const { auth, context, store, authService, issued } = createLifecycleContext()
    vi.mocked(context.services.ssh.connect).mockRejectedValue(new Error('boom'))

    await auth.handleAuthentication(credentials)

    expect(issued).toHaveLength(1)
    expect(store.getSessionIds()).toHaveLength(0)
    expect(sessionInfo(authService, issued[0] as SessionId)).toBeNull()
  })

  it('releases the previous session when the socket authenticates again', async () => {
    const { auth, control, context, store, authService, issued } = createLifecycleContext()

    await auth.handleAuthentication(credentials)
    await auth.handleAuthentication(credentials)
    await auth.handleAuthentication(credentials)

    expect(issued).toHaveLength(3)
    const [first, second, third] = issued as [SessionId, SessionId, SessionId]
    expect(context.state.sessionId).toBe(third)
    expect(store.getSessionIds()).toEqual([third])
    expect(sessionInfo(authService, first)).toBeNull()
    expect(sessionInfo(authService, second)).toBeNull()
    expect(sessionInfo(authService, third)).not.toBeNull()
    expect(context.services.sftp?.cancelSessionTransfers).toHaveBeenCalledWith(first)
    expect(context.services.sftp?.cancelSessionTransfers).toHaveBeenCalledWith(second)
    expect(context.services.sftp?.cancelSessionTransfers).not.toHaveBeenCalledWith(third)

    control.handleDisconnect()

    expect(store.getSessionIds()).toHaveLength(0)
    expect(sessionInfo(authService, third)).toBeNull()
  })
})
