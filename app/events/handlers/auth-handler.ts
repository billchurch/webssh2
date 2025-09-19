/**
 * Authentication event handlers
 */

import type { EventBus } from '../event-bus.js'
import type { AuthService } from '../../services/interfaces.js'
import type { SessionStore } from '../../state/store.js'
import { EventPriority } from '../types.js'
import { isEventType } from '../types.js'
import debug from 'debug'

const logger = debug('webssh2:events:auth')

/**
 * Create and register auth event handlers
 */
export function createAuthHandlers(
  eventBus: EventBus,
  authService: AuthService,
  sessionStore: SessionStore
): void {
  // Handle authentication requests
  eventBus.subscribe('auth.request', async (event) => {
    const { sessionId, method, username, password, host, port } = event.payload

    logger('Processing auth request for session %s, method: %s', sessionId, method)

    try {
      // Dispatch auth request to store
      sessionStore.dispatch(sessionId, {
        type: 'AUTH_REQUEST',
        payload: { method, username }
      })

      // Perform authentication
      const result = await authService.authenticate({
        username,
        password: password ?? '',
        host: host ?? 'localhost',
        port: port ?? 22
      })

      if (result.ok) {
        // Dispatch success to store
        sessionStore.dispatch(sessionId, {
          type: 'AUTH_SUCCESS',
          payload: {
            username: result.value.username,
            method,
            userId: result.value.userId
          }
        })

        // Publish success event
        await eventBus.publish({
          type: 'auth.success',
          payload: {
            sessionId,
            userId: result.value.userId,
            username: result.value.username,
            method
          }
        }, EventPriority.HIGH)

        logger('Auth success for session %s, user: %s', sessionId, username)
      } else {
        // Dispatch failure to store
        sessionStore.dispatch(sessionId, {
          type: 'AUTH_FAILURE',
          payload: {
            method,
            error: result.error.message
          }
        })

        // Publish failure event
        await eventBus.publish({
          type: 'auth.failure',
          payload: {
            sessionId,
            reason: result.error.message,
            method
          }
        }, EventPriority.HIGH)

        logger('Auth failure for session %s: %s', sessionId, result.error.message)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed'

      // Dispatch error to store
      sessionStore.dispatch(sessionId, {
        type: 'AUTH_FAILURE',
        payload: {
          method,
          error: errorMessage
        }
      })

      // Publish error event
      await eventBus.publish({
        type: 'auth.failure',
        payload: {
          sessionId,
          reason: errorMessage,
          method
        }
      }, EventPriority.HIGH)

      // Also publish system error
      await eventBus.publish({
        type: 'system.error',
        payload: {
          error: error instanceof Error ? error : new Error(errorMessage),
          context: 'AuthHandler.auth.request',
          sessionId
        }
      }, EventPriority.HIGH)

      logger('Auth error for session %s: %O', sessionId, error)
    }
  })

  // Handle logout requests
  eventBus.subscribe('auth.logout', async (event) => {
    const { sessionId, userId } = event.payload

    logger('Processing logout for session %s', sessionId)

    try {
      // Clear authentication
      if (userId !== undefined) {
        // Note: AuthService doesn't have a revoke method for userId
        // We'll revoke the session instead
        await authService.revokeSession(sessionId)
      }

      // Dispatch logout to store
      sessionStore.dispatch(sessionId, {
        type: 'AUTH_LOGOUT'
      })

      // Publish session destroyed event
      await eventBus.publish({
        type: 'session.destroyed',
        payload: {
          sessionId,
          reason: 'User logout'
        }
      }, EventPriority.NORMAL)

      logger('Logout completed for session %s', sessionId)
    } catch (error) {
      logger('Logout error for session %s: %O', sessionId, error)

      await eventBus.publish({
        type: 'system.error',
        payload: {
          error: error instanceof Error ? error : new Error('Logout failed'),
          context: 'AuthHandler.auth.logout',
          sessionId
        }
      }, EventPriority.NORMAL)
    }
  })

  // Handle clear credentials
  eventBus.subscribe('auth.clear', (event) => {
    const { sessionId } = event.payload

    logger('Clearing credentials for session %s', sessionId)

    try {
      // Clear error state
      sessionStore.dispatch(sessionId, {
        type: 'AUTH_CLEAR_ERROR'
      })

      logger('Credentials cleared for session %s', sessionId)
    } catch (error) {
      logger('Clear credentials error for session %s: %O', sessionId, error)
    }
  })

  // Handle session timeout
  eventBus.subscribe('session.timeout', async (event) => {
    if (isEventType(event, 'session.timeout')) {
      const { sessionId } = event.payload

      logger('Session timeout for %s, triggering logout', sessionId)

      // Trigger logout
      await eventBus.publish({
        type: 'auth.logout',
        payload: { sessionId }
      }, EventPriority.HIGH)
    }
  })

  // Handle connection errors that should clear auth
  eventBus.subscribe('connection.error', (event) => {
    if (isEventType(event, 'connection.error')) {
      const { sessionId, code } = event.payload

      // Clear auth on certain connection errors
      const authErrorCodes = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH']
      if (code !== undefined && authErrorCodes.includes(code)) {
        logger('Connection error %s for session %s, clearing auth', code, sessionId)

        sessionStore.dispatch(sessionId, {
          type: 'CONNECTION_ERROR',
          payload: {
            error: event.payload.error
          }
        })
      }
    }
  })

  logger('Auth event handlers registered')
}

/**
 * Create auth validation handler
 */
export function createAuthValidationHandler(
  eventBus: EventBus,
  authService: AuthService
): void {
  // Validate auth state before certain operations
  eventBus.subscribe('connection.request', async (event) => {
    if (isEventType(event, 'connection.request')) {
      const { sessionId } = event.payload

      // Check if session is authenticated
      const result = authService.validateSession(sessionId)
      const isValid = result.ok && result.value

      if (isValid !== true) {
        logger('Session %s not authenticated, rejecting connection', sessionId)

        // Publish auth required event
        await eventBus.publish({
          type: 'auth.failure',
          payload: {
            sessionId,
            reason: 'Authentication required',
            method: 'manual'
          }
        }, EventPriority.HIGH)

        // Stop the connection attempt
        throw new Error('Authentication required')
      }
    }
  }, { priority: EventPriority.HIGH })

  logger('Auth validation handler registered')
}

/**
 * Create auth metrics handler
 */
export function createAuthMetricsHandler(eventBus: EventBus): void {
  const metrics = {
    requests: 0,
    successes: 0,
    failures: 0,
    logouts: 0
  }

  eventBus.subscribe('auth.request', () => {
    metrics.requests++
  })

  eventBus.subscribe('auth.success', () => {
    metrics.successes++
  })

  eventBus.subscribe('auth.failure', () => {
    metrics.failures++
  })

  eventBus.subscribe('auth.logout', () => {
    metrics.logouts++
  })

  // Periodically publish metrics
  setInterval(() => {
    eventBus.publish({
      type: 'system.metrics',
      payload: {
        metric: 'auth.stats',
        value: 1,
        tags: {
          requests: String(metrics.requests),
          successes: String(metrics.successes),
          failures: String(metrics.failures),
          logouts: String(metrics.logouts)
        }
      }
    }).catch(error => {
      logger('Failed to publish auth metrics: %O', error)
    })
  }, 60000) // Every minute

  logger('Auth metrics handler registered')
}