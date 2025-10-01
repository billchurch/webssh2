import { describe, expect, it } from 'vitest'
import { buildSocketLogContext, emitSocketLog } from '../../../app/logging/socket-logger.js'
import { createAdapterSharedState, type AdapterContext } from '../../../app/socket/adapters/service-socket-shared.js'
import type { Services } from '../../../app/services/interfaces.js'
import type { UnifiedAuthPipeline } from '../../../app/auth/auth-pipeline.js'
import { createStructuredLoggerStub } from '../../test-utils.js'
import type { StructuredLoggerStub } from '../../test-utils.js'
import type { SessionId } from '../../../app/types/branded.js'
import { TEST_NETWORK, TEST_SOCKET_CONSTANTS, TEST_USER_AGENTS } from '../../test-constants.js'

const createTestAdapterContext = (): { context: AdapterContext; logger: StructuredLoggerStub } => {
  const state = createAdapterSharedState()
  state.sessionId = 'session-123' as SessionId
  state.connectionId = 'conn-123'
  state.clientIp = TEST_NETWORK.CLIENT_CONTEXT_IP
  state.clientPort = TEST_NETWORK.FORWARDED_PORT
  state.clientSourcePort = TEST_NETWORK.FORWARDED_PORT
  state.targetHost = TEST_SOCKET_CONSTANTS.TARGET_HOST
  state.targetPort = 22
  state.username = 'jdoe'
  state.userAgent = TEST_USER_AGENTS.DEFAULT

  const logger = createStructuredLoggerStub()

  const context: AdapterContext = {
    socket: {
      id: 'socket-1',
      emit: () => undefined,
      on: () => undefined,
      onAny: () => undefined,
      handshake: { headers: {}, address: TEST_NETWORK.CLIENT_CONTEXT_IP }
    } as unknown as AdapterContext['socket'],
    config: {} as AdapterContext['config'],
    services: {} as Services,
    authPipeline: {} as UnifiedAuthPipeline,
    state,
    debug: () => undefined,
    logger
  }

  return { context, logger }
}

describe('socket-logger', () => {
  it('buildSocketLogContext includes adapter state', () => {
    const { context } = createTestAdapterContext()
    const logContext = buildSocketLogContext(context, 'session_init', {
      status: 'success',
      subsystem: 'shell'
    })

    expect(logContext.sessionId).toBe('session-123')
    expect(logContext.connectionId).toBe('conn-123')
    expect(logContext.clientIp).toBe(TEST_NETWORK.CLIENT_CONTEXT_IP)
    expect(logContext.clientPort).toBe(TEST_NETWORK.FORWARDED_PORT)
    expect(logContext.clientSourcePort).toBe(TEST_NETWORK.FORWARDED_PORT)
    expect(logContext.userAgent).toBe(TEST_USER_AGENTS.DEFAULT)
    expect(logContext.targetHost).toBe(TEST_SOCKET_CONSTANTS.TARGET_HOST)
    expect(logContext.targetPort).toBe(22)
    expect(logContext.status).toBe('success')
  })

  it('omits user agent for non session_init events', () => {
    const { context } = createTestAdapterContext()
    const logContext = buildSocketLogContext(context, 'auth_success', {})

    expect(logContext.userAgent).toBeUndefined()
    expect(logContext.clientPort).toBe(TEST_NETWORK.FORWARDED_PORT)
    expect(logContext.clientSourcePort).toBe(TEST_NETWORK.FORWARDED_PORT)
  })

  it('emitSocketLog records entry on structured logger', () => {
    const { context, logger } = createTestAdapterContext()

    emitSocketLog(context, 'info', 'auth_success', 'Authentication succeeded', {
      status: 'success',
      data: { host: TEST_SOCKET_CONSTANTS.TARGET_HOST }
    })

    expect(logger.entries).toHaveLength(1)
    const entry = logger.entries[0]
    expect(entry.level).toBe('info')
    expect(entry.entry.event).toBe('auth_success')
    expect(entry.entry.data).toEqual({ host: TEST_SOCKET_CONSTANTS.TARGET_HOST })
    expect(entry.entry.context?.status).toBe('success')
  })
})
