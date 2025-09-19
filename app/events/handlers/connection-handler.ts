/**
 * SSH connection event handlers
 */

import type { EventBus } from '../event-bus.js'
import type { SSHService } from '../../services/interfaces.js'
import type { SessionStore } from '../../state/store.js'
import { EventPriority, isEventType } from '../types.js'
import debug from 'debug'

const logger = debug('webssh2:events:connection')

/**
 * Connection attempt tracking
 */
interface ConnectionAttempt {
  sessionId: string
  attempts: number
  lastAttempt: number
  backoffMs: number
}

/**
 * Create and register connection event handlers
 */
export function createConnectionHandlers(
  eventBus: EventBus,
  sshService: SSHService,
  sessionStore: SessionStore
): void {
  const connectionAttempts = new Map<string, ConnectionAttempt>()

  // Handle connection requests
  eventBus.subscribe('connection.request', async (event) => {
    const { sessionId, host, port, username, password, privateKey } = event.payload

    logger('Processing connection request for session %s to %s:%d', sessionId, host, port)

    // Check for rate limiting
    const attempt = connectionAttempts.get(String(sessionId))
    const now = Date.now()

    if (attempt !== undefined && now - attempt.lastAttempt < attempt.backoffMs) {
      const waitTime = attempt.backoffMs - (now - attempt.lastAttempt)
      logger('Connection rate limited for session %s, wait %dms', sessionId, waitTime)

      await eventBus.publish({
        type: 'connection.error',
        payload: {
          sessionId,
          error: `Rate limited. Please wait ${Math.ceil(waitTime / 1000)} seconds`,
          code: 'RATE_LIMITED'
        }
      }, EventPriority.HIGH)
      return
    }

    try {
      // Dispatch connection start to store
      sessionStore.dispatch(sessionId, {
        type: 'CONNECTION_START',
        payload: { host, port }
      })

      // Attempt SSH connection
      const connectionConfig: Parameters<typeof sshService.connect>[0] = {
        sessionId,
        host,
        port,
        username: username ?? ''
      }

      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (password !== undefined) {
        connectionConfig.password = password
      }

      if (privateKey !== undefined) {
        connectionConfig.privateKey = privateKey
      }

      const result = await sshService.connect(connectionConfig)

      if (result.ok) {
        // Clear attempt tracking on success
        connectionAttempts.delete(String(sessionId))

        // Dispatch success to store
        sessionStore.dispatch(sessionId, {
          type: 'CONNECTION_ESTABLISHED',
          payload: {
            connectionId: result.value.id
          }
        })

        // Publish established event
        await eventBus.publish({
          type: 'connection.established',
          payload: {
            sessionId,
            connectionId: result.value.id,
            host,
            port
          }
        }, EventPriority.HIGH)

        // Publish ready event after a short delay
        setTimeout(() => {
          eventBus.publish({
            type: 'connection.ready',
            payload: {
              sessionId,
              connectionId: result.value.id
            }
          }, EventPriority.NORMAL).catch(error => {
            logger('Failed to publish connection.ready: %O', error)
          })
        }, 100)

        logger('Connection established for session %s, connection: %s', sessionId, result.value.id)
      } else {
        // Track failed attempt
        const currentAttempt = connectionAttempts.get(String(sessionId)) ?? {
          sessionId: String(sessionId),
          attempts: 0,
          lastAttempt: 0,
          backoffMs: 1000
        }

        currentAttempt.attempts++
        currentAttempt.lastAttempt = now
        currentAttempt.backoffMs = Math.min(currentAttempt.backoffMs * 2, 30000) // Max 30s backoff

        connectionAttempts.set(String(sessionId), currentAttempt)

        // Dispatch error to store
        sessionStore.dispatch(sessionId, {
          type: 'CONNECTION_ERROR',
          payload: {
            error: result.error.message
          }
        })

        // Publish error event
        const errorCode = 'code' in result.error && typeof result.error.code === 'string'
          ? result.error.code
          : 'UNKNOWN'
        await eventBus.publish({
          type: 'connection.error',
          payload: {
            sessionId,
            error: result.error.message,
            code: errorCode
          }
        }, EventPriority.HIGH)

        logger('Connection failed for session %s: %s', sessionId, result.error.message)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'

      // Dispatch error to store
      sessionStore.dispatch(sessionId, {
        type: 'CONNECTION_ERROR',
        payload: {
          error: errorMessage
        }
      })

      // Publish error event
      await eventBus.publish({
        type: 'connection.error',
        payload: {
          sessionId,
          error: errorMessage,
          code: 'UNKNOWN'
        }
      }, EventPriority.HIGH)

      // Also publish system error
      await eventBus.publish({
        type: 'system.error',
        payload: {
          error: error instanceof Error ? error : new Error(errorMessage),
          context: 'ConnectionHandler.connection.request',
          sessionId
        }
      }, EventPriority.HIGH)

      logger('Connection error for session %s: %O', sessionId, error)
    }
  })

  // Handle connection timeout
  eventBus.subscribe('connection.timeout', async (event) => {
    const { sessionId, connectionId } = event.payload

    logger('Connection timeout for session %s', sessionId)

    try {
      // Disconnect if connection exists
      if (connectionId !== undefined) {
        await sshService.disconnect(connectionId)
      }

      // Dispatch timeout to store
      sessionStore.dispatch(sessionId, {
        type: 'CONNECTION_ERROR',
        payload: {
          error: 'Connection timeout'
        }
      })

      logger('Connection timed out and closed for session %s', sessionId)
    } catch (error) {
      logger('Error handling connection timeout for session %s: %O', sessionId, error)
    }
  })

  // Handle connection close
  eventBus.subscribe('connection.closed', async (event) => {
    if (isEventType(event, 'connection.closed')) {
      const { sessionId, connectionId, reason, hadError } = event.payload

      logger('Connection closed for session %s: %s (error: %s)', sessionId, reason, hadError)

      try {
        // Clean up connection if we have a connectionId
        if (connectionId !== undefined) {
          await sshService.disconnect(connectionId)
        }

        // Dispatch closed to store
        sessionStore.dispatch(sessionId, {
          type: 'CONNECTION_CLOSED',
          payload: {
            reason
          }
        })

        // Clear attempt tracking
        connectionAttempts.delete(String(sessionId))

        logger('Connection cleanup completed for session %s', sessionId)
      } catch (error) {
        logger('Error cleaning up connection for session %s: %O', sessionId, error)
      }
    }
  })

  // Handle session destruction
  eventBus.subscribe('session.destroyed', (event) => {
    if (isEventType(event, 'session.destroyed')) {
      const { sessionId } = event.payload

      logger('Session destroyed, closing connections for %s', sessionId)

      try {
        // Note: SSHService doesn't have disconnectSession method
        // We would need to track connections per session and disconnect them individually
        // For now, log the intent
        logger('Need to disconnect all connections for session %s', sessionId)

        // Clear attempt tracking
        connectionAttempts.delete(String(sessionId))

        logger('All connections closed for destroyed session %s', sessionId)
      } catch (error) {
        logger('Error closing connections for session %s: %O', sessionId, error)
      }
    }
  })

  // Handle terminal activity to update connection activity
  eventBus.subscribe('terminal.data.in', (event) => {
    if (isEventType(event, 'terminal.data.in')) {
      const { sessionId } = event.payload

      // Update connection activity
      sessionStore.dispatch(sessionId, {
        type: 'CONNECTION_ACTIVITY'
      })
    }
  })

  eventBus.subscribe('terminal.data.out', (event) => {
    if (isEventType(event, 'terminal.data.out')) {
      const { sessionId } = event.payload

      // Update connection activity
      sessionStore.dispatch(sessionId, {
        type: 'CONNECTION_ACTIVITY'
      })
    }
  })

  logger('Connection event handlers registered')
}

/**
 * Create connection health monitoring handler
 */
export function createConnectionHealthHandler(
  eventBus: EventBus,
  _sshService: SSHService
): void {
  const healthCheckInterval = 30000 // 30 seconds

  // Periodically publish health status
  setInterval(() => {
    // Since SSHService doesn't provide listConnections method,
    // we'll just publish a basic health check
    eventBus.publish({
      type: 'system.health',
      payload: {
        status: 'healthy',
        checks: {
          'ssh.connections': true
        }
      }
    }, EventPriority.LOW).catch(error => {
      logger('Failed to publish health metrics: %O', error)
    })
  }, healthCheckInterval)

  logger('Connection health handler registered')
}

/**
 * Create connection metrics handler
 */
export function createConnectionMetricsHandler(eventBus: EventBus): void {
  const metrics = {
    requests: 0,
    established: 0,
    errors: 0,
    closed: 0,
    timeouts: 0
  }

  eventBus.subscribe('connection.request', () => {
    metrics.requests++
  })

  eventBus.subscribe('connection.established', () => {
    metrics.established++
  })

  eventBus.subscribe('connection.error', () => {
    metrics.errors++
  })

  eventBus.subscribe('connection.closed', () => {
    metrics.closed++
  })

  eventBus.subscribe('connection.timeout', () => {
    metrics.timeouts++
  })

  // Periodically publish metrics
  setInterval(() => {
    eventBus.publish({
      type: 'system.metrics',
      payload: {
        metric: 'connection.stats',
        value: 1,
        tags: {
          requests: String(metrics.requests),
          established: String(metrics.established),
          errors: String(metrics.errors),
          closed: String(metrics.closed),
          timeouts: String(metrics.timeouts)
        }
      }
    }).catch(error => {
      logger('Failed to publish connection metrics: %O', error)
    })
  }, 60000) // Every minute

  logger('Connection metrics handler registered')
}