import { describe, expect, it } from 'vitest'
import { buildSocketLogContext, emitSocketLog } from '../../../app/logging/socket-logger.js'
import { createAdapterSharedState, type AdapterContext } from '../../../app/socket/adapters/service-socket-shared.js'
import type { Services } from '../../../app/services/interfaces.js'
import type { UnifiedAuthPipeline } from '../../../app/auth/auth-pipeline.js'
import { createStructuredLoggerStub } from '../../test-utils.js'
import type { StructuredLoggerStub } from '../../test-utils.js'
import type { SessionId } from '../../../app/types/branded.js'

const createTestAdapterContext = (): { context: AdapterContext; logger: StructuredLoggerStub } => {
  const state = createAdapterSharedState()
  state.sessionId = 'session-123' as SessionId
  state.connectionId = 'conn-123'
  state.clientIp = '198.51.100.1'
  state.clientPort = 443
  state.targetHost = '10.0.0.5'
  state.targetPort = 22
  state.username = 'jdoe'

  const logger = createStructuredLoggerStub()

  const context: AdapterContext = {
    socket: {
      id: 'socket-1',
      emit: () => undefined,
      on: () => undefined,
      onAny: () => undefined,
      handshake: { headers: {}, address: '198.51.100.1' }
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
    const logContext = buildSocketLogContext(context, {
      status: 'success',
      subsystem: 'shell'
    })

    expect(logContext.sessionId).toBe('session-123')
    expect(logContext.connectionId).toBe('conn-123')
    expect(logContext.clientIp).toBe('198.51.100.1')
    expect(logContext.targetHost).toBe('10.0.0.5')
    expect(logContext.targetPort).toBe(22)
    expect(logContext.status).toBe('success')
  })

  it('emitSocketLog records entry on structured logger', () => {
    const { context, logger } = createTestAdapterContext()

    emitSocketLog(context, 'info', 'auth_success', 'Authentication succeeded', {
      status: 'success',
      data: { host: '10.0.0.5' }
    })

    expect(logger.entries).toHaveLength(1)
    const entry = logger.entries[0]
    expect(entry.level).toBe('info')
    expect(entry.entry.event).toBe('auth_success')
    expect(entry.entry.data).toEqual({ host: '10.0.0.5' })
    expect(entry.entry.context?.status).toBe('success')
  })
})
