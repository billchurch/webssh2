import { describe, expect, it, vi } from 'vitest'
import { ServiceSocketAuthentication } from '../../../app/socket/adapters/service-socket-authentication.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from '../../../app/socket/adapters/service-socket-shared.js'
import { SOCKET_EVENTS } from '../../../app/constants/socket-events.js'
import { createMockSocketConfig, createMockServices, createStructuredLoggerStub } from '../../test-utils.js'
import type { Config } from '../../../app/types/config.js'
import type { Services } from '../../../app/services/interfaces.js'
import type { UnifiedAuthPipeline } from '../../../app/auth/auth-pipeline.js'
import { createAuthMethod } from '../../../app/types/branded.js'
import { AUTH_METHOD_TOKENS } from '../../../app/constants/index.js'
import type { AuthCredentials } from '../../../app/types/contracts/v1/socket.js'

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
