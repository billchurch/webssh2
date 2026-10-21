/**
 * Unit tests for AuthService
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { AuthServiceImpl } from '../../../app/services/auth/auth-service.js'
import type { Credentials } from '../../../app/services/interfaces.js'
import { createSessionId, createTransferId, type SessionId } from '../../../app/types/branded.js'
import { TransferManager } from '../../../app/services/sftp/transfer-manager.js'
import { TEST_USERNAME, TEST_PASSWORD, TEST_PASSWORDS, TEST_SSH } from '../../test-constants.js'
import { createMockStore, createMockDependencies } from '../../test-utils.js'

async function loginWithTestUsername(
  authService: AuthServiceImpl,
  password: string,
  host: string
): Promise<SessionId> {
  const result = await authService.authenticate({
    username: TEST_USERNAME,
    password,
    host,
    port: TEST_SSH.PORT
  })
  if (!result.ok) {
    throw result.error
  }
  return result.value.sessionId
}

describe('AuthService', () => {
  let authService: AuthServiceImpl
  let mockDeps: ReturnType<typeof createMockDependencies>
  let mockStore: ReturnType<typeof createMockStore>

  beforeEach(() => {
    mockStore = createMockStore()
    mockDeps = createMockDependencies()
    // Add extra SSH config properties that auth tests need
    mockDeps.config.ssh.disableInteractiveAuth = false
    mockDeps.config.ssh.algorithms = {
      cipher: [],
      compress: [],
      hmac: [],
      kex: [],
      serverHostKey: []
    }
    mockDeps.config.terminal = { rows: 24, cols: 80, term: 'xterm-256color' }
    mockDeps.config.logging = { namespace: 'webssh2:test' }
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

    it('should issue a fresh session for each login', async () => {
      const credentials: Credentials = {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      }

      const result1 = await authService.authenticate(credentials)
      const result2 = await authService.authenticate(credentials)

      expect(result1.ok && result2.ok).toBe(true)
      if (result1.ok && result2.ok) {
        expect(result2.value.sessionId).not.toBe(result1.value.sessionId)
        expect(result2.value.userId).not.toBe(result1.value.userId)
      }
      expect(mockStore.createSession).toHaveBeenCalledTimes(2)
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

  describe('logins with the same username', () => {
    it('should give each login its own session id', async () => {
      const first = await loginWithTestUsername(authService, TEST_PASSWORD, TEST_SSH.HOST)
      const second = await loginWithTestUsername(authService, TEST_PASSWORDS.secret, TEST_SSH.IP_ADDRESS)

      expect(second).not.toBe(first)
      expect(mockStore.createSession).toHaveBeenNthCalledWith(1, first)
      expect(mockStore.createSession).toHaveBeenNthCalledWith(2, second)
    })

    it('should key each login\'s transfers by its own session id', async () => {
      const first = await loginWithTestUsername(authService, TEST_PASSWORD, TEST_SSH.HOST)
      const second = await loginWithTestUsername(authService, TEST_PASSWORDS.secret, TEST_SSH.IP_ADDRESS)

      const transfers = new TransferManager({
        maxConcurrentTransfers: 2,
        defaultRateLimitBytesPerSec: 0
      })
      const firstTransfer = createTransferId('transfer-first')
      const secondTransfer = createTransferId('transfer-second')
      for (const [transferId, sessionId] of [
        [firstTransfer, first],
        [secondTransfer, second]
      ] as const) {
        const started = transfers.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/tmp/file.txt',
          fileName: 'file.txt',
          totalBytes: 100
        })
        expect(started.ok).toBe(true)
      }

      // The first login cannot act on the second login's transfer
      expect(transfers.verifyOwnership(secondTransfer, first).ok).toBe(false)
      expect(transfers.verifyOwnership(secondTransfer, second).ok).toBe(true)

      // Cancelling by the first login's id leaves the second one alone
      // (socket disconnect is covered in service-socket-disconnect-isolation)
      transfers.cancelSessionTransfers(first)

      expect(transfers.getTransfer(firstTransfer)).toBeUndefined()
      expect(transfers.getTransfer(secondTransfer)).toBeDefined()
      expect(transfers.verifyOwnership(secondTransfer, second).ok).toBe(true)
    })

    it('should keep the other login valid when one is revoked', async () => {
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

      const first = await loginWithTestUsername(authService, TEST_PASSWORD, TEST_SSH.HOST)
      const second = await loginWithTestUsername(authService, TEST_PASSWORDS.secret, TEST_SSH.IP_ADDRESS)

      const revoked = await authService.revokeSession(first)
      expect(revoked.ok).toBe(true)

      expect(authService.validateSession(first)).toEqual({ ok: true, value: false })
      expect(authService.validateSession(second)).toEqual({ ok: true, value: true })
      expect(mockStore.removeSession).toHaveBeenCalledWith(first)
      expect(mockStore.removeSession).not.toHaveBeenCalledWith(second)
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