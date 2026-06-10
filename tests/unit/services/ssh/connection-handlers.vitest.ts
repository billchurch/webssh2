/**
 * Unit tests for SSH connection handlers (settled-guard race protection)
 *
 * Covers issue #536: a late 'ready' event after the connect timeout has
 * already settled must not pool the abandoned connection or dispatch
 * CONNECTION_ESTABLISHED. Error/close side effects stay ungated because
 * those listeners live for the connection's whole lifetime.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Client } from 'ssh2'
import {
  registerConnectionHandlers,
  type ConnectionHandlerDependencies,
  type RegisterConnectionHandlersInput
} from '../../../../app/services/ssh/connection-handlers.js'
import { ConnectionPool } from '../../../../app/services/ssh/connection-pool.js'
import type { ConnectionLogger } from '../../../../app/services/ssh/connection-logger.js'
import type { SessionStore } from '../../../../app/state/store.js'
import type { SSHConfig, SSHConnection } from '../../../../app/services/interfaces.js'
import { createConnectionId, createSessionId } from '../../../../app/types/branded.js'
import { TEST_USERNAME, TEST_PASSWORD, TEST_SSH } from '../../../test-constants.js'

interface MockClientWithTrigger {
  on: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  _trigger: (event: string, ...args: unknown[]) => void
}

const createMockClient = (): MockClientWithTrigger => {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const eventHandlers = handlers.get(event) ?? []
      eventHandlers.push(handler)
      handlers.set(event, eventHandlers)
      return undefined
    }),
    end: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => {
      const eventHandlers = handlers.get(event) ?? []
      for (const handler of eventHandlers) {
        handler(...args)
      }
    }
  }
}

const createTestConfig = (): SSHConfig => ({
  sessionId: createSessionId('test-session'),
  host: TEST_SSH.HOST,
  port: TEST_SSH.PORT,
  username: TEST_USERNAME,
  password: TEST_PASSWORD
})

const createTestConnection = (config: SSHConfig, client: Client): SSHConnection => ({
  id: createConnectionId('test-connection'),
  sessionId: config.sessionId,
  client,
  status: 'connecting',
  createdAt: Date.now(),
  lastActivity: Date.now(),
  host: config.host,
  port: config.port,
  username: config.username
})

interface Harness {
  client: MockClientWithTrigger
  pool: ConnectionPool
  store: SessionStore
  connection: SSHConnection
  config: SSHConfig
  onReady: ReturnType<typeof vi.fn>
  onError: ReturnType<typeof vi.fn>
}

const setupHandlers = (isSettled: () => boolean): Harness => {
  const client = createMockClient()
  const pool = new ConnectionPool()
  const store = { dispatch: vi.fn() } as unknown as SessionStore
  const connectionLogger: ConnectionLogger = {
    log: vi.fn(),
    baseFromConfig: vi.fn((config: SSHConfig) => ({
      sessionId: config.sessionId,
      host: config.host,
      port: config.port,
      username: config.username
    })),
    baseFromConnection: vi.fn((connection: SSHConnection) => ({
      sessionId: connection.sessionId,
      host: connection.host,
      port: connection.port,
      username: connection.username
    }))
  }
  const config = createTestConfig()
  const connection = createTestConnection(config, client as unknown as Client)
  const onReady = vi.fn()
  const onError = vi.fn()

  const deps: ConnectionHandlerDependencies = {
    pool,
    store,
    connectionLogger,
    debug: vi.fn()
  }
  const input: RegisterConnectionHandlersInput = {
    client: client as unknown as Client,
    connection,
    config,
    isSettled,
    onReady,
    onError
  }
  registerConnectionHandlers(deps, input)

  return { client, pool, store, connection, config, onReady, onError }
}

describe('registerConnectionHandlers', () => {
  describe('ready handler', () => {
    it('ignores a late ready event when already settled', () => {
      const harness = setupHandlers(() => true)

      harness.client._trigger('ready')

      expect(harness.pool.get(harness.connection.id)).toBeUndefined()
      expect(harness.store.dispatch).not.toHaveBeenCalled()
      expect(harness.onReady).not.toHaveBeenCalled()
      expect(harness.connection.status).toBe('connecting')
    })

    it('pools the connection and dispatches when not settled', () => {
      const harness = setupHandlers(() => false)

      harness.client._trigger('ready')

      expect(harness.pool.get(harness.connection.id)).toBe(harness.connection)
      expect(harness.store.dispatch).toHaveBeenCalledWith(
        harness.config.sessionId,
        expect.objectContaining({
          type: 'CONNECTION_ESTABLISHED',
          payload: { connectionId: harness.connection.id }
        })
      )
      expect(harness.onReady).toHaveBeenCalledTimes(1)
      expect(harness.connection.status).toBe('connected')
    })
  })

  describe('error handler', () => {
    it('dispatches CONNECTION_ERROR even when already settled', () => {
      const harness = setupHandlers(() => true)
      const error = new Error('runtime failure')

      harness.client._trigger('error', error)

      expect(harness.store.dispatch).toHaveBeenCalledWith(
        harness.config.sessionId,
        expect.objectContaining({ type: 'CONNECTION_ERROR' })
      )
      expect(harness.onError).toHaveBeenCalledTimes(1)
      expect(harness.connection.status).toBe('error')
    })
  })

  describe('close handler', () => {
    it('dispatches CONNECTION_CLOSED and removes from pool even when already settled', () => {
      const harness = setupHandlers(() => true)
      harness.pool.add(harness.connection)

      harness.client._trigger('close')

      expect(harness.pool.get(harness.connection.id)).toBeUndefined()
      expect(harness.store.dispatch).toHaveBeenCalledWith(
        harness.config.sessionId,
        expect.objectContaining({ type: 'CONNECTION_CLOSED' })
      )
    })
  })
})
