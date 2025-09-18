/**
 * System event handlers for monitoring and health
 */

import type { EventBus } from '../event-bus.js'
import { EventPriority, isEventType } from '../types.js'
import debug from 'debug'

const logger = debug('webssh2:events:system')

/**
 * Error tracking
 */
interface ErrorTracking {
  count: number
  lastError: Error | string
  lastOccurrence: number
  context: string
}

/**
 * Create system event handlers
 */
export function createSystemHandlers(eventBus: EventBus): void {
  const errorTracking = new Map<string, ErrorTracking>()
  const systemMetrics = {
    errors: 0,
    warnings: 0,
    info: 0
  }

  // Handle system errors
  eventBus.subscribe('system.error', (event) => {
    if (isEventType(event, 'system.error')) {
      const { error, context, sessionId, connectionId } = event.payload

      systemMetrics.errors++

      // Track error patterns
      const key = `${context}:${error instanceof Error ? error.message : error}`
      const tracking = errorTracking.get(key) ?? {
        count: 0,
        lastError: error,
        lastOccurrence: 0,
        context
      }

      tracking.count++
      tracking.lastOccurrence = Date.now()
      errorTracking.set(key, tracking)

      // Log error with context
      logger('System error in %s: %O', context, error)
      if (sessionId !== undefined) {logger('  Session: %s', sessionId)}
      if (connectionId !== undefined) {logger('  Connection: %s', connectionId)}

      // Alert if error rate is high
      if (tracking.count > 10) {
        logger('High error rate detected for %s: %d errors', context, tracking.count)
      }
    }
  })

  // Handle warnings
  eventBus.subscribe('system.warning', (event) => {
    if (isEventType(event, 'system.warning')) {
      const { message, details, sessionId } = event.payload

      systemMetrics.warnings++

      logger('System warning: %s', message)
      if (details !== undefined) {logger('  Details: %O', details)}
      if (sessionId !== undefined) {logger('  Session: %s', sessionId)}
    }
  })

  // Handle info messages
  eventBus.subscribe('system.info', (event) => {
    if (isEventType(event, 'system.info')) {
      const { message, details } = event.payload

      systemMetrics.info++

      logger('System info: %s', message)
      if (details !== undefined) {logger('  Details: %O', details)}
    }
  })

  // Handle metrics collection
  eventBus.subscribe('system.metrics', (event) => {
    if (isEventType(event, 'system.metrics')) {
      const { metric, value, tags } = event.payload

      logger('Metric: %s = %d', metric, value)
      if (tags !== undefined) {logger('  Tags: %O', tags)}
    }
  })

  // Handle health status
  eventBus.subscribe('system.health', (event) => {
    if (isEventType(event, 'system.health')) {
      const { status, checks } = event.payload

      logger('System health: %s', status)
      for (const [check, result] of Object.entries(checks)) {
        logger('  %s: %s', check, result ? 'OK' : 'FAILED')
      }

      // Alert on unhealthy status
      if (status !== 'healthy') {
        logger('ALERT: System is %s', status)
      }
    }
  })

  // Periodically clean up old error tracking
  setInterval(() => {
    const now = Date.now()
    const staleThreshold = 3600000 // 1 hour

    for (const [key, tracking] of errorTracking) {
      if (now - tracking.lastOccurrence > staleThreshold) {
        errorTracking.delete(key)
      }
    }

    logger('Cleaned up error tracking, %d entries remaining', errorTracking.size)
  }, 600000) // Every 10 minutes

  // Periodically publish system metrics
  setInterval(() => {
    eventBus.publish({
      type: 'system.metrics',
      payload: {
        metric: 'system.events',
        value: systemMetrics.errors + systemMetrics.warnings + systemMetrics.info,
        tags: {
          errors: String(systemMetrics.errors),
          warnings: String(systemMetrics.warnings),
          info: String(systemMetrics.info)
        }
      }
    }).catch(error => {
      logger('Failed to publish system metrics: %O', error)
    })

    // Reset counters
    systemMetrics.errors = 0
    systemMetrics.warnings = 0
    systemMetrics.info = 0
  }, 60000) // Every minute

  logger('System event handlers registered')
}

/**
 * Create crash recovery handler
 */
export function createCrashRecoveryHandler(eventBus: EventBus): void {
  let criticalErrors = 0
  const criticalThreshold = 5
  const resetInterval = 60000 // 1 minute

  eventBus.subscribe('system.error', async (event) => {
    if (isEventType(event, 'system.error')) {
      const { context } = event.payload

      // Track critical errors
      if (context.includes('Fatal') || context.includes('Critical')) {
        criticalErrors++

        if (criticalErrors >= criticalThreshold) {
          logger('CRITICAL: Too many critical errors (%d), initiating recovery', criticalErrors)

          // Publish health status
          await eventBus.publish({
            type: 'system.health',
            payload: {
              status: 'unhealthy',
              checks: {
                'error.rate': false,
                'critical.errors': false
              }
            }
          }, EventPriority.CRITICAL)

          // Could trigger recovery actions here
          // For now, just log and reset counter
          criticalErrors = 0
        }
      }
    }
  })

  // Reset critical error counter periodically
  setInterval(() => {
    if (criticalErrors > 0) {
      logger('Resetting critical error counter (was %d)', criticalErrors)
      criticalErrors = 0
    }
  }, resetInterval)

  logger('Crash recovery handler registered')
}

/**
 * Create performance monitoring handler
 */
export function createPerformanceHandler(eventBus: EventBus): void {
  const performanceMetrics = new Map<string, {
    count: number
    totalTime: number
    minTime: number
    maxTime: number
  }>()

  // Monitor event processing times
  const originalPublish = eventBus.publish.bind(eventBus)
  eventBus.publish = async function(event, priority) {
    const start = Date.now()

    try {
      await originalPublish(event, priority)
    } finally {
      const duration = Date.now() - start
      const key = event.type

      const metrics = performanceMetrics.get(key) ?? {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0
      }

      metrics.count++
      metrics.totalTime += duration
      metrics.minTime = Math.min(metrics.minTime, duration)
      metrics.maxTime = Math.max(metrics.maxTime, duration)

      performanceMetrics.set(key, metrics)

      // Warn on slow events
      if (duration > 1000) {
        logger('Slow event: %s took %dms', event.type, duration)
      }
    }
  }

  // Periodically report performance metrics
  setInterval(() => {
    if (performanceMetrics.size > 0) {
      for (const [eventType, metrics] of performanceMetrics) {
        const avgTime = metrics.totalTime / metrics.count

        eventBus.publish({
          type: 'system.metrics',
          payload: {
            metric: `event.performance.${eventType}`,
            value: avgTime,
            tags: {
              count: String(metrics.count),
              min: String(metrics.minTime),
              max: String(metrics.maxTime),
              avg: String(avgTime)
            }
          }
        }, EventPriority.LOW).catch(error => {
          logger('Failed to publish performance metrics: %O', error)
        })
      }

      // Reset metrics
      performanceMetrics.clear()
    }
  }, 300000) // Every 5 minutes

  logger('Performance monitoring handler registered')
}