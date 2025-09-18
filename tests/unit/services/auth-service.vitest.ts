/**
 * Unit tests for AuthService
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { AuthServiceImpl } from '../../../app/services/auth/auth-service.js'
import type { ServiceDependencies, Credentials } from '../../../app/services/interfaces.js'
import type { SessionStore } from '../../../app/state/store.js'
import { createSessionId } from '../../../app/types/branded.js'
import { TEST_USERNAME, TEST_PASSWORD, TEST_SSH } from '../../test-constants.js'

describe('AuthService', () => {
  let authService: AuthServiceImpl
  let mockDeps: ServiceDependencies
  let mockStore: SessionStore

  beforeEach(() => {
    // Create mock store
    mockStore = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      createSession: vi.fn(),
      removeSession: vi.fn(),
      getSessionIds: vi.fn(() => []),
      hasSession: vi.fn(() => false),
      getHistory: vi.fn(() => []),
      clear: vi.fn()
    } as unknown as SessionStore

    // Create mock dependencies
    mockDeps = {
      config: {
        session: {
          secret: 'test-secret',
          name: 'test-session',
          sessionTimeout: 3600000, // 1 hour
          maxHistorySize: 100
        },
        ssh: {
          host: null,
          port: 22,
          term: 'xterm-256color',
          readyTimeout: 20000,
          keepaliveInterval: 30000,
          keepaliveCountMax: 10,
          alwaysSendKeyboardInteractivePrompts: false,
          disableInteractiveAuth: false,
          algorithms: {
            cipher: [],
            compress: [],
            hmac: [],
            kex: [],
            serverHostKey: []
          }
        },
        options: {
          challengeButton: false,
          allowReauth: true,
          allowReplay: false,
          allowReconnect: false,
          autoLog: false
        },
        algorithms: {},
        serverlog: { client: false, server: false },
        terminal: { rows: 24, cols: 80, term: 'xterm-256color' },
        logging: { namespace: 'webssh2:test' }
      },
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    }

    authService = new AuthServiceImpl(mockDeps, mockStore)
  })

  describe('authenticate', () => {
    it('should authenticate valid credentials', async () => {
      const credentials: Credentials = {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      }

      const result = await authService.authenticate(credentials)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveProperty('sessionId')
        expect(result.value).toHaveProperty('userId')
        expect(result.value.username).toBe(TEST_USERNAME)
        expect(result.value.method).toBe('manual')
      }

      // Verify store was called
      expect(mockStore.createSession).toHaveBeenCalled()
      expect(mockStore.dispatch).toHaveBeenCalled()
    })

    it('should reject invalid credentials', async () => {
      const credentials: Credentials = {
        username: '',
        password: TEST_PASSWORD,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      }

      const result = await authService.authenticate(credentials)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('Invalid credentials')
      }

      // Store should not be updated
      expect(mockStore.createSession).not.toHaveBeenCalled()
    })

    it('should handle missing password and privateKey', async () => {
      const credentials: Credentials = {
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      }

      const result = await authService.authenticate(credentials)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('No authentication method')
      }
    })

    it('should use cached session if valid', async () => {
      const credentials: Credentials = {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      }

      // First authentication
      const result1 = await authService.authenticate(credentials)
      expect(result1.ok).toBe(true)

      // Second authentication should use cache
      const result2 = await authService.authenticate(credentials)
      expect(result2.ok).toBe(true)

      // Store should only be created once
      expect(mockStore.createSession).toHaveBeenCalledTimes(1)
    })

    it('should handle privateKey authentication', async () => {
      const credentials: Credentials = {
        username: TEST_USERNAME,
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----',
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      }

      const result = await authService.authenticate(credentials)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.method).toBe('manual')
      }
    })
  })

  describe('validateSession', () => {
    it('should validate authenticated session', async () => {
      // First authenticate to populate cache
      const credentials: Credentials = {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      }
      
      const mockState = {
        auth: {
          status: 'authenticated' as const,
          username: TEST_USERNAME,
          method: 'manual' as const,
          timestamp: Date.now(),
          errorMessage: null
        }
      };
      (mockStore.getState as Mock).mockReturnValue(mockState)
      
      const authResult = await authService.authenticate(credentials)
      expect(authResult.ok).toBe(true)
      
      if (authResult.ok) {
        const result = authService.validateSession(authResult.value.sessionId)
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toBe(true)
        }
      }
    })

    it('should reject unauthenticated session', () => {
      const sessionId = createSessionId('test-session')
      const mockState = {
        auth: {
          status: 'pending' as const,
          username: null,
          method: null,
          timestamp: Date.now(),
          errorMessage: null
        }
      };
      (mockStore.getState as Mock).mockReturnValue(mockState)

      const result = authService.validateSession(sessionId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(false)
      }
    })

    it('should reject non-existent session', () => {
      const sessionId = createSessionId('non-existent');
      (mockStore.getState as Mock).mockReturnValue(undefined)

      const result = authService.validateSession(sessionId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(false)
      }
    })
  })

  describe('revokeSession', () => {
    it('should revoke existing session', async () => {
      const sessionId = createSessionId('test-session')
      const mockState = {
        auth: {
          status: 'authenticated' as const,
          username: TEST_USERNAME,
          method: 'manual' as const,
          timestamp: Date.now(),
          errorMessage: null
        }
      };
      (mockStore.getState as Mock).mockReturnValue(mockState)

      const result = await authService.revokeSession(sessionId)

      expect(result.ok).toBe(true)
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'AUTH_LOGOUT'
        })
      )
    })

    it('should handle non-existent session', async () => {
      const sessionId = createSessionId('non-existent');
      (mockStore.getState as Mock).mockReturnValue(undefined)

      const result = await authService.revokeSession(sessionId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('Session not found')
      }
    })
  })

  describe('getSessionInfo', () => {
    it('should return session info for authenticated session', () => {
      const sessionId = createSessionId('test-session')
      const mockState = {
        auth: {
          status: 'authenticated' as const,
          username: TEST_USERNAME,
          method: 'manual' as const,
          timestamp: Date.now(),
          errorMessage: null
        },
        metadata: {
          createdAt: Date.now() - 10000,
          updatedAt: Date.now()
        }
      };
      (mockStore.getState as Mock).mockReturnValue(mockState)

      const result = authService.getSessionInfo(sessionId)

      expect(result.ok).toBe(true)
      if (result.ok && result.value !== null) {
        expect(result.value.sessionId).toBe(sessionId)
        expect(result.value.username).toBe(TEST_USERNAME)
        expect(result.value.method).toBe('manual')
      }
    })

    it('should return null for non-existent session', () => {
      const sessionId = createSessionId('non-existent');
      (mockStore.getState as Mock).mockReturnValue(undefined)

      const result = authService.getSessionInfo(sessionId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeNull()
      }
    })
  })

  describe('session timeout', () => {
    it('should invalidate expired sessions', async () => {
      const credentials: Credentials = {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      }

      // Authenticate
      const result = await authService.authenticate(credentials)
      expect(result.ok).toBe(true)

      if (result.ok) {
        // Fast-forward time past session timeout
        vi.useFakeTimers()
        vi.advanceTimersByTime(3700000) // 1 hour + 100 seconds

        // Validate should fail
        const validateResult = authService.validateSession(result.value.sessionId)
        expect(validateResult.ok).toBe(true)
        if (validateResult.ok) {
          expect(validateResult.value).toBe(false)
        }

        vi.useRealTimers()
      }
    })
  })
})