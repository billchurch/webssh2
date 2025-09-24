/**
 * Unit tests for SessionService
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { SessionServiceImpl } from '../../../app/services/session/session-service.js'
import type { SessionParams } from '../../../app/services/interfaces.js'
import { createSessionId, createUserId, createConnectionId } from '../../../app/types/branded.js'
import { TEST_USERNAME, TEST_SSH } from '../../test-constants.js'
import { createMockStore, createMockDependencies, setupMockStoreState, setupMockStoreStates, createSessionState } from '../../test-utils.js'

describe('SessionService', () => {
  let sessionService: SessionServiceImpl
  let mockDeps: ReturnType<typeof createMockDependencies>
  let mockStore: ReturnType<typeof createMockStore>

  beforeEach(() => {
    mockStore = createMockStore()
    mockDeps = createMockDependencies()
    sessionService = new SessionServiceImpl(mockDeps, mockStore)
  })

  describe('create', () => {
    it('should create a new session', () => {
      const params: SessionParams = {
        userId: createUserId('test-user'),
        clientIp: '127.0.0.1',
        userAgent: 'test-agent'
      }

      const mockState = {
        auth: {
          status: 'pending' as const,
          username: null,
          method: null,
          timestamp: Date.now(),
          errorMessage: null
        },
        connection: {
          status: 'idle' as const,
          host: null,
          port: null,
          connectionId: null,
          errorMessage: null
        },
        terminal: {
          terminalId: null,
          rows: 24,
          cols: 80,
          environment: {}
        },
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          userId: params.userId,
          clientIp: params.clientIp,
          userAgent: params.userAgent
        }
      };

      (mockStore.getState as Mock)
        .mockReturnValueOnce(undefined) // First call to check if session exists
        .mockReturnValue(mockState); // After creating session
      (mockStore.createSession as Mock).mockReturnValue(mockState)

      const result = sessionService.create(params)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.state).toBe(mockState)
        expect(result.value.createdAt).toBe(mockState.metadata.createdAt)
        expect(result.value.updatedAt).toBe(mockState.metadata.updatedAt)
      }

      expect(mockStore.createSession).toHaveBeenCalled()
      expect(mockStore.dispatch).toHaveBeenCalled()
    })

    it('should return existing session if already exists', () => {
      const sessionId = createSessionId('existing-session')
      const params: SessionParams = { id: sessionId }

      const mockState = {
        auth: { status: 'authenticated' as const, username: TEST_USERNAME, method: 'manual' as const, timestamp: Date.now(), errorMessage: null },
        connection: { status: 'connected' as const, host: TEST_SSH.HOST, port: TEST_SSH.PORT, connectionId: createConnectionId('test'), errorMessage: null },
        terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
        metadata: { createdAt: Date.now() - 1000, updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
      };

      (mockStore.getState as Mock).mockReturnValue(mockState)

      const result = sessionService.create(params)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.id).toBe(sessionId)
        expect(result.value.state).toBe(mockState)
      }

      expect(mockStore.createSession).not.toHaveBeenCalled()
    })

    it('should generate session ID if not provided', () => {
      const params: SessionParams = {}

      const mockState = {
        auth: { status: 'pending' as const, username: null, method: null, timestamp: Date.now(), errorMessage: null },
        connection: { status: 'idle' as const, host: null, port: null, connectionId: null, errorMessage: null },
        terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
      };

      (mockStore.getState as Mock).mockReturnValue(undefined);
      (mockStore.createSession as Mock).mockReturnValue(mockState)

      const result = sessionService.create(params)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // UUID v4 format
        expect(result.value.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
      }
    })
  })

  describe('get', () => {
    it('should return existing session', () => {
      const sessionId = createSessionId('test-session')

      const mockState = {
        auth: { status: 'authenticated' as const, username: TEST_USERNAME, method: 'manual' as const, timestamp: Date.now(), errorMessage: null },
        connection: { status: 'connected' as const, host: TEST_SSH.HOST, port: TEST_SSH.PORT, connectionId: createConnectionId('test'), errorMessage: null },
        terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
        metadata: { createdAt: Date.now() - 1000, updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
      };

      (mockStore.getState as Mock).mockReturnValue(mockState)

      const result = sessionService.get(sessionId)

      expect(result.ok).toBe(true)
      if (result.ok && result.value) {
        expect(result.value.id).toBe(sessionId)
        expect(result.value.state).toBe(mockState)
      }
    })

    it('should return null for non-existent session', () => {
      const sessionId = createSessionId('non-existent');
      (mockStore.getState as Mock).mockReturnValue(undefined)

      const result = sessionService.get(sessionId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeNull()
      }
    })
  })

  describe('update', () => {
    it('should update auth status', () => {
      const sessionId = createSessionId('test-session')

      const mockState = {
        auth: { status: 'pending' as const, username: null, method: null, timestamp: Date.now(), errorMessage: null },
        connection: { status: 'idle' as const, host: null, port: null, connectionId: null, errorMessage: null },
        terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
        metadata: { createdAt: Date.now() - 1000, updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
      };

      const updatedState = {
        ...mockState,
        auth: { status: 'authenticated' as const, username: TEST_USERNAME, method: 'manual' as const, timestamp: Date.now(), errorMessage: null }
      };

      (mockStore.getState as Mock)
        .mockReturnValueOnce(mockState)
        .mockReturnValueOnce(updatedState)

      const result = sessionService.update(sessionId, {
        auth: { status: 'authenticated', username: TEST_USERNAME, method: 'manual', timestamp: Date.now(), errorMessage: null }
      })

      expect(result.ok).toBe(true)
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'AUTH_SUCCESS',
          payload: {
            username: TEST_USERNAME,
            method: 'manual'
          }
        })
      )
    })

    it('should update connection status', () => {
      const sessionId = createSessionId('test-session')
      const connectionId = createConnectionId('test-conn')

      const mockState = {
        auth: { status: 'authenticated' as const, username: TEST_USERNAME, method: 'manual' as const, timestamp: Date.now(), errorMessage: null },
        connection: { status: 'connecting' as const, host: TEST_SSH.HOST, port: TEST_SSH.PORT, connectionId: null, errorMessage: null },
        terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
        metadata: { createdAt: Date.now() - 1000, updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
      };

      const updatedState = {
        ...mockState,
        connection: { status: 'connected' as const, host: TEST_SSH.HOST, port: TEST_SSH.PORT, connectionId, errorMessage: null }
      };

      (mockStore.getState as Mock)
        .mockReturnValueOnce(mockState)
        .mockReturnValueOnce(updatedState)

      const result = sessionService.update(sessionId, {
        connection: { status: 'connected', connectionId, host: TEST_SSH.HOST, port: TEST_SSH.PORT, errorMessage: null }
      })

      expect(result.ok).toBe(true)
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'CONNECTION_ESTABLISHED',
          payload: { connectionId }
        })
      )
    })

    it('should update terminal dimensions', () => {
      const sessionId = createSessionId('test-session')

      const mockState = {
        auth: { status: 'authenticated' as const, username: TEST_USERNAME, method: 'manual' as const, timestamp: Date.now(), errorMessage: null },
        connection: { status: 'connected' as const, host: TEST_SSH.HOST, port: TEST_SSH.PORT, connectionId: createConnectionId('test'), errorMessage: null },
        terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
        metadata: { createdAt: Date.now() - 1000, updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
      };

      const updatedState = {
        ...mockState,
        terminal: { terminalId: null, rows: 30, cols: 100, environment: {} }
      };

      (mockStore.getState as Mock)
        .mockReturnValueOnce(mockState)
        .mockReturnValueOnce(updatedState)

      const result = sessionService.update(sessionId, {
        terminal: { terminalId: null, rows: 30, cols: 100, environment: {} }
      })

      expect(result.ok).toBe(true)
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'TERMINAL_RESIZE',
          payload: { rows: 30, cols: 100 }
        })
      )
    })

    it('should handle non-existent session', () => {
      const sessionId = createSessionId('non-existent');
      (mockStore.getState as Mock).mockReturnValue(undefined)

      const result = sessionService.update(sessionId, {
        auth: { status: 'authenticated', username: TEST_USERNAME, method: 'manual', timestamp: Date.now(), errorMessage: null }
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Session not found')
      }
    })
  })

  describe('delete', () => {
    it('should delete existing session', () => {
      const sessionId = createSessionId('test-session')

      const result = sessionService.delete(sessionId)

      expect(result.ok).toBe(true)
      expect(mockStore.removeSession).toHaveBeenCalledWith(sessionId)
    })

    it('should handle delete errors gracefully', () => {
      const sessionId = createSessionId('test-session')
      const error = new Error('Delete failed');
      (mockStore.removeSession as Mock).mockImplementation(() => {
        throw error
      })

      const result = sessionService.delete(sessionId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Delete failed')
      }
    })
  })

  describe('list', () => {
    it('should list all sessions', () => {
      const sessionIds = [
        createSessionId('session1'),
        createSessionId('session2'),
        createSessionId('session3')
      ];

      (mockStore.getSessionIds as Mock).mockReturnValue(sessionIds)

      const mockStates = sessionIds.map((id, index) => ({
        auth: { status: 'authenticated' as const, username: `user${index}`, method: 'manual' as const, timestamp: Date.now(), errorMessage: null },
        connection: { status: 'connected' as const, host: TEST_SSH.HOST, port: TEST_SSH.PORT, connectionId: createConnectionId(`conn${index}`), errorMessage: null },
        terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
        metadata: { createdAt: Date.now() - 1000 * (index + 1), updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
      }));

      (mockStore.getState as Mock).mockImplementation((id: unknown) => {
        const index = sessionIds.indexOf(id as typeof sessionIds[number])
        return index >= 0 ? mockStates[index] : undefined
      })

      const result = sessionService.list()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(3)
        expect(result.value[0].id).toBe(sessionIds[0])
        expect(result.value[1].id).toBe(sessionIds[1])
        expect(result.value[2].id).toBe(sessionIds[2])
      }
    })

    it('should handle empty session list', () => {
      (mockStore.getSessionIds as Mock).mockReturnValue([])

      const result = sessionService.list()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual([])
      }
    })
  })

  describe('subscribe', () => {
    it('should subscribe to session changes', () => {
      const sessionId = createSessionId('test-session')
      const callback = vi.fn()
      const unsubscribe = vi.fn();

      (mockStore.subscribe as Mock).mockReturnValue(unsubscribe)

      const result = sessionService.subscribe(sessionId, callback)

      expect(mockStore.subscribe).toHaveBeenCalledWith(sessionId, expect.any(Function))
      expect(result).toBe(unsubscribe)
    })

    it('should transform state to session in callback', () => {
      const sessionId = createSessionId('test-session')
      const callback = vi.fn()
      let storeCallback: ((state: unknown) => void) | undefined;

      (mockStore.subscribe as Mock).mockImplementation((id: unknown, cb: (state: unknown) => void) => {
        storeCallback = cb
        return vi.fn()
      })

      sessionService.subscribe(sessionId, callback)

      const newState = {
        auth: { status: 'authenticated' as const, username: TEST_USERNAME, method: 'manual' as const, timestamp: Date.now(), errorMessage: null },
        connection: { status: 'connected' as const, host: TEST_SSH.HOST, port: TEST_SSH.PORT, connectionId: createConnectionId('test'), errorMessage: null },
        terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
        metadata: { createdAt: Date.now() - 1000, updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
      }

      // Trigger the callback
      if (storeCallback) {
        storeCallback(newState)
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sessionId,
          state: newState,
          createdAt: newState.metadata.createdAt,
          updatedAt: newState.metadata.updatedAt
        })
      )
    })
  })

  describe('getStats', () => {
    it('should return session statistics', () => {
      const sessionIds = [
        createSessionId('session1'),
        createSessionId('session2'),
        createSessionId('session3')
      ];

      (mockStore.getSessionIds as Mock).mockReturnValue(sessionIds)

      const mockStates = [
        { // Active session
          auth: { status: 'authenticated' as const, username: 'user1', method: 'manual' as const, timestamp: Date.now(), errorMessage: null },
          connection: { status: 'connected' as const, host: TEST_SSH.HOST, port: TEST_SSH.PORT, connectionId: createConnectionId('conn1'), errorMessage: null },
          terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
          metadata: { createdAt: Date.now() - 1000, updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
        },
        { // Not authenticated
          auth: { status: 'pending' as const, username: null, method: null, timestamp: Date.now(), errorMessage: null },
          connection: { status: 'idle' as const, host: null, port: null, connectionId: null, errorMessage: null },
          terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
          metadata: { createdAt: Date.now() - 2000, updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
        },
        { // Authenticated but not connected
          auth: { status: 'authenticated' as const, username: 'user3', method: 'manual' as const, timestamp: Date.now(), errorMessage: null },
          connection: { status: 'closed' as const, host: TEST_SSH.HOST, port: TEST_SSH.PORT, connectionId: null, errorMessage: null },
          terminal: { terminalId: null, rows: 24, cols: 80, environment: {} },
          metadata: { createdAt: Date.now() - 3000, updatedAt: Date.now(), userId: null, clientIp: null, userAgent: null }
        }
      ];

      (mockStore.getState as Mock).mockImplementation((id: unknown) => {
        const index = sessionIds.indexOf(id as typeof sessionIds[number])
        return index >= 0 ? mockStates[index] : undefined
      })

      const stats = sessionService.getStats()

      expect(stats.totalSessions).toBe(3)
      expect(stats.activeSessions).toBe(1) // Only first session is active
    })

    it('should return zeros on error', () => {
      (mockStore.getSessionIds as Mock).mockImplementation(() => {
        throw new Error('Store error')
      })

      const stats = sessionService.getStats()

      expect(stats.totalSessions).toBe(0)
      expect(stats.activeSessions).toBe(0)
    })
  })

  describe('cleanup', () => {
    it('should clean up all sessions', () => {
      sessionService.cleanup()

      expect(mockStore.clear).toHaveBeenCalled()
    })
  })
})