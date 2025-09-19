/**
 * Authentication service implementation
 */

import { randomUUID } from 'node:crypto'
import type {
  AuthService,
  AuthResult,
  Credentials,
  ServiceDependencies
} from '../interfaces.js'
import type { SessionId, UserId } from '../../types/branded.js'
import type { Result } from '../../state/types.js'
import { ok, err } from '../../state/types.js'
import { createSessionId, createUserId } from '../../types/branded.js'
import type { SessionStore } from '../../state/store.js'
import { DEFAULTS } from '../../constants.js'
// import { UnifiedAuthPipeline } from '../../auth/auth-pipeline.js' // Not used yet
import debug from 'debug'

const logger = debug('webssh2:services:auth')

/**
 * In-memory auth cache for session validation
 */
interface AuthCache {
  sessionId: SessionId
  userId: UserId
  username: string
  method: 'basic' | 'manual' | 'post' | 'keyboard-interactive'
  createdAt: number
  expiresAt: number
}

export class AuthServiceImpl implements AuthService {
  private readonly authCache = new Map<SessionId, AuthCache>()
  private readonly sessionTimeout: number

  constructor(
    private readonly deps: ServiceDependencies,
    private readonly store: SessionStore
  ) {
    this.sessionTimeout = deps.config.session.sessionTimeout ?? DEFAULTS.SESSION_TIMEOUT_MS
  }

  /**
   * Authenticate with credentials
   */
  authenticate(credentials: Credentials): Promise<Result<AuthResult>> {
    try {
      logger('Authenticating user:', credentials.username)

      // Validate credentials
      const validationError = this.validateCredentials(credentials)
      if (validationError !== null) {
        return Promise.resolve(err(new Error(validationError)))
      }

      // Check for existing cached session with same credentials
      for (const [, cached] of this.authCache.entries()) {
        if (cached.username === credentials.username && 
            cached.expiresAt > Date.now()) {
          // Return existing session
          return Promise.resolve(ok({
            sessionId: cached.sessionId,
            userId: cached.userId,
            username: cached.username,
            method: cached.method,
            expiresAt: cached.expiresAt
          }))
        }
      }

      // Generate session and user IDs
      const sessionId = createSessionId(randomUUID())
      const userId = createUserId(randomUUID())

      // Create session in store
      this.store.createSession(sessionId)

      // Dispatch authentication action
      this.store.dispatch(sessionId, {
        type: 'AUTH_SUCCESS',
        payload: {
          username: credentials.username,
          method: 'manual'
        }
      })

      // Update connection info
      this.store.dispatch(sessionId, {
        type: 'CONNECTION_START',
        payload: {
          host: credentials.host,
          port: credentials.port
        }
      })

      // Create auth result
      const authResult: AuthResult = {
        sessionId,
        userId,
        username: credentials.username,
        method: 'manual',
        expiresAt: Date.now() + this.sessionTimeout
      }

      // Cache authentication info
      this.authCache.set(sessionId, {
        sessionId: authResult.sessionId,
        userId: authResult.userId,
        username: authResult.username,
        method: authResult.method,
        createdAt: Date.now(),
        expiresAt: authResult.expiresAt ?? Date.now() + this.sessionTimeout
      })

      logger('Authentication successful for:', credentials.username)
      return Promise.resolve(ok(authResult))
    } catch (error) {
      logger('Authentication failed:', error)
      return Promise.resolve(err(error instanceof Error ? error : new Error('Authentication failed')))
    }
  }

  /**
   * Validate a session
   */
  validateSession(sessionId: SessionId): Result<boolean> {
    const cached = this.authCache.get(sessionId)
    
    if (cached === undefined) {
      logger('Session not found:', sessionId)
      return ok(false)
    }

    // Check if session is expired
    if (cached.expiresAt < Date.now()) {
      logger('Session expired:', sessionId)
      this.authCache.delete(sessionId)
      return ok(false)
    }

    // Check store state
    const state = this.store.getState(sessionId)
    if (state === undefined || state.auth.status !== 'authenticated') {
      logger('Session not authenticated in store:', sessionId)
      return ok(false)
    }

    return ok(true)
  }

  /**
   * Revoke a session
   */
  revokeSession(sessionId: SessionId): Promise<Result<void>> {
    try {
      logger('Revoking session:', sessionId)

      // Check if session exists
      const state = this.store.getState(sessionId)
      if (state === undefined) {
        return Promise.resolve(err(new Error('Session not found')))
      }

      // Remove from cache
      this.authCache.delete(sessionId)

      // Update store state
      this.store.dispatch(sessionId, {
        type: 'AUTH_LOGOUT'
      })

      // Clean up session from store
      this.store.removeSession(sessionId)

      logger('Session revoked:', sessionId)
      return Promise.resolve(ok(undefined))
    } catch (error) {
      logger('Failed to revoke session:', error)
      return Promise.resolve(err(error instanceof Error ? error : new Error('Failed to revoke session')))
    }
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: SessionId): Result<AuthResult | null> {
    const cached = this.authCache.get(sessionId)
    
    if (cached === undefined) {
      return ok(null)
    }

    // Check if expired
    if (cached.expiresAt < Date.now()) {
      this.authCache.delete(sessionId)
      return ok(null)
    }

    return ok({
      sessionId: cached.sessionId,
      userId: cached.userId,
      username: cached.username,
      method: cached.method,
      expiresAt: cached.expiresAt
    })
  }

  /**
   * Validate credentials format
   */
  private validateCredentials(credentials: Credentials): string | null {
    if (typeof credentials.username !== 'string' || credentials.username === '') {
      return 'Invalid credentials format'
    }

    if (typeof credentials.host !== 'string' || credentials.host === '') {
      return 'Invalid credentials format'
    }

    if (typeof credentials.port !== 'number' || credentials.port <= 0 || credentials.port > 65535) {
      return 'Invalid credentials format'
    }

    // Must have either password or privateKey
    const hasPassword = typeof credentials.password === 'string' && credentials.password.length > 0
    const hasPrivateKey = typeof credentials.privateKey === 'string' && credentials.privateKey.length > 0

    if (!hasPassword && !hasPrivateKey) {
      return 'No authentication method provided'
    }

    return null
  }


  /**
   * Clean up expired sessions (can be called periodically)
   */
  cleanupExpiredSessions(): void {
    const now = Date.now()
    const expiredSessions: SessionId[] = []

    for (const [sessionId, cache] of this.authCache.entries()) {
      if (cache.expiresAt < now) {
        expiredSessions.push(sessionId)
      }
    }

    for (const sessionId of expiredSessions) {
      logger('Cleaning up expired session:', sessionId)
      this.authCache.delete(sessionId)
      this.store.removeSession(sessionId)
    }

    if (expiredSessions.length > 0) {
      logger(`Cleaned up ${expiredSessions.length} expired sessions`)
    }
  }
}