import { describe, expect, it, vi } from 'vitest'
import { ServiceSocketControl } from '../../../app/socket/adapters/service-socket-control.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from '../../../app/socket/adapters/service-socket-shared.js'
import type { Services } from '../../../app/services/interfaces.js'
import type { UnifiedAuthPipeline } from '../../../app/auth/auth-pipeline.js'
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '../../../app/types/contracts/v1/socket.js'
import type { Socket } from 'socket.io'
import { createStructuredLoggerStub, type StructuredLoggerStub } from '../../test-utils.js'
import { TEST_PASSWORDS } from '../../test-constants.js'

interface MinimalSocket extends Partial<Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>> {
  id: string
}

function createContext(
  options?: { allowReplay?: boolean }
): { control: ServiceSocketControl; logger: StructuredLoggerStub; context: AdapterContext } {
  const state = createAdapterSharedState()
  state.sessionId = 'session-log' as never
  state.connectionId = 'conn-log'

  const logger = createStructuredLoggerStub()
  const socket: MinimalSocket = {
    id: 'socket-1',
    emit: vi.fn()
  }

  const context: AdapterContext = {
    socket: socket as Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    config: {
      options: {
        allowReplay: options?.allowReplay ?? true,
        allowReauth: true,
        allowReconnect: true,
        autoLog: false
      }
    } as AdapterContext['config'],
    services: {
      terminal: {
        destroy: vi.fn()
      }
    } as unknown as Services,
    authPipeline: {} as UnifiedAuthPipeline,
    state,
    protocol: 'ssh',
    debug: vi.fn(),
    logger
  }

  const control = new ServiceSocketControl(context)
  return { control, logger, context }
}

describe('ServiceSocketControl logging', () => {

  it('logs credential replay success', () => {
    const { control, logger, context } = createContext({ allowReplay: true })
    context.state.storedPassword = TEST_PASSWORDS.secret
    context.state.shellStream = {
      write: vi.fn()
    } as unknown as AdapterContext['state']['shellStream']

    control.handleControl('replayCredentials')

    const entry = logger.entries.find(item => item.entry.event === 'credential_replay')
    expect(entry).toBeDefined()
    expect(entry?.entry.context?.status).toBe('success')
    expect(entry?.entry.data).toMatchObject({ allowReplay: true })
  })

  it('logs credential replay denial when disallowed', () => {
    const { control, logger } = createContext({ allowReplay: false })

    control.handleControl('replayCredentials')

    const entry = logger.entries.find(item => item.entry.event === 'credential_replay')
    expect(entry).toBeDefined()
    expect(entry?.level).toBe('warn')
    expect(entry?.entry.context?.status).toBe('failure')
    expect(entry?.entry.context?.reason).toContain('not permitted')
  })
})
