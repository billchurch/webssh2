/**
 * Event middleware system for cross-cutting concerns
 */

import type { AppEvent, EventPriority } from './types.js'
import { EventBus } from './event-bus.js'
import debug from 'debug'

const logger = debug('webssh2:events:middleware')

/**
 * Event middleware function type
 */
export type EventMiddleware = (
  event: AppEvent,
  next: () => Promise<void>
) => Promise<void>

/**
 * Event context passed through middleware
 */
export interface EventContext {
  event: AppEvent
  priority: EventPriority
  metadata?: Record<string, unknown>
  startTime?: number
}

/**
 * Event bus with middleware support
 */
export class EventBusWithMiddleware extends EventBus {
  private middlewares: EventMiddleware[] = []

  /**
   * Add middleware to the pipeline
   */
  use(middleware: EventMiddleware): void {
    this.middlewares.push(middleware)
    logger('Added middleware (total: %d)', this.middlewares.length)
  }

  /**
   * Remove middleware from the pipeline
   */
  removeMiddleware(middleware: EventMiddleware): boolean {
    const index = this.middlewares.indexOf(middleware)
    if (index !== -1) {
      this.middlewares.splice(index, 1)
      logger('Removed middleware (remaining: %d)', this.middlewares.length)
      return true
    }
    return false
  }

  /**
   * Clear all middleware
   */
  clearMiddleware(): void {
    this.middlewares = []
    logger('Cleared all middleware')
  }

  /**
   * Override publish to run through middleware
   */
  override async publish(
    event: AppEvent,
    priority?: EventPriority
  ): Promise<void> {
    if (this.middlewares.length === 0) {
      // No middleware, use parent implementation
      return super.publish(event, priority)
    }

    // Run through middleware chain
    let index = 0

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++]
        if (middleware !== undefined) {
          await middleware(event, next)
        }
      } else {
        // All middleware processed, publish the event
        await super.publish(event, priority)
      }
    }

    await next()
  }
}

/**
 * Logging middleware - logs all events
 */
export const loggingMiddleware: EventMiddleware = async (event, next) => {
  const start = Date.now()
  logger('Event: %s', event.type, event.payload)

  try {
    await next()
    const duration = Date.now() - start
    logger('Event %s processed in %dms', event.type, duration)
  } catch (error) {
    const duration = Date.now() - start
    logger('Event %s failed after %dms: %O', event.type, duration, error)
    throw error
  }
}

/**
 * Metrics collection middleware
 */
export const metricsMiddleware = (
  metricsCollector?: (metric: string, value: number, tags?: Record<string, string>) => void
): EventMiddleware => {
  return async (event, next) => {
    const start = Date.now()
    const metric = `event.${event.type}`

    try {
      await next()
      const duration = Date.now() - start

      if (metricsCollector !== undefined) {
        metricsCollector(metric, 1, { status: 'success' })
        metricsCollector(`${metric}.duration`, duration)
      }
    } catch (error) {
      const duration = Date.now() - start

      if (metricsCollector !== undefined) {
        metricsCollector(metric, 1, { status: 'error' })
        metricsCollector(`${metric}.duration`, duration)
      }

      throw error
    }
  }
}

/**
 * Error handling middleware - catches and logs errors
 */
export const errorHandlingMiddleware: EventMiddleware = async (event, next) => {
  try {
    await next()
  } catch (error) {
    logger('Error processing event %s: %O', event.type, error)

    // Re-throw unless it's already a system error event (prevent loops)
    if (event.type === 'system.error') {
      logger('Suppressing error for system.error event to prevent loops')
    } else {
      throw error
    }
  }
}

/**
 * Rate limiting middleware
 */
export const rateLimitingMiddleware = (
  maxEventsPerSecond: number = 100
): EventMiddleware => {
  const eventCounts = new Map<string, { count: number; resetTime: number }>()

  return async (event, next) => {
    const now = Date.now()
    const key = event.type
    const limit = eventCounts.get(key)

    if (limit !== undefined) {
      if (now < limit.resetTime) {
        if (limit.count >= maxEventsPerSecond) {
          logger('Rate limit exceeded for %s (%d/%d)', key, limit.count, maxEventsPerSecond)
          throw new Error(`Rate limit exceeded for ${key}`)
        }
        limit.count++
      } else {
        // Reset the counter
        limit.count = 1
        limit.resetTime = now + 1000
      }
    } else {
      eventCounts.set(key, {
        count: 1,
        resetTime: now + 1000
      })
    }

    // Clean up old entries periodically
    if (eventCounts.size > 100) {
      for (const [k, v] of eventCounts) {
        if (now > v.resetTime + 5000) {
          eventCounts.delete(k)
        }
      }
    }

    await next()
  }
}

/**
 * Filtering middleware - filters events based on conditions
 */
export const filteringMiddleware = (
  filter: (event: AppEvent) => boolean
): EventMiddleware => {
  return async (event, next) => {
    if (filter(event)) {
      await next()
    } else {
      logger('Event %s filtered out', event.type)
    }
  }
}

/**
 * Deduplication middleware - prevents duplicate events
 */
export const deduplicationMiddleware = (
  windowMs: number = 1000
): EventMiddleware => {
  const recentEvents = new Map<string, number>()

  return async (event, next) => {
    const now = Date.now()
    const eventKey = `${event.type}:${JSON.stringify(event.payload)}`
    const lastSeen = recentEvents.get(eventKey)

    if (lastSeen !== undefined && now - lastSeen < windowMs) {
      logger('Duplicate event %s suppressed', event.type)
      return
    }

    recentEvents.set(eventKey, now)

    // Clean up old entries
    if (recentEvents.size > 1000) {
      for (const [key, time] of recentEvents) {
        if (now - time > windowMs * 2) {
          recentEvents.delete(key)
        }
      }
    }

    await next()
  }
}

/**
 * Validation middleware - validates event structure
 */
export const validationMiddleware: EventMiddleware = async (event, next) => {
  // Event is already typed as AppEvent, so basic structure is guaranteed
  // Type-specific validation could be added here
  await next()
}

/**
 * Circuit breaker middleware - stops processing if too many errors
 */
export const circuitBreakerMiddleware = (
  threshold: number = 5,
  resetMs: number = 60000
): EventMiddleware => {
  const states = new Map<string, {
    failures: number
    lastFailure: number
    isOpen: boolean
  }>()

  return async (event, next) => {
    const now = Date.now()
    const key = event.type
    let state = states.get(key)

    if (state === undefined) {
      state = { failures: 0, lastFailure: 0, isOpen: false }
      states.set(key, state)
    }

    // Reset if enough time has passed
    if (state.isOpen && now - state.lastFailure > resetMs) {
      state.failures = 0
      state.isOpen = false
      logger('Circuit breaker reset for %s', key)
    }

    // Check if circuit is open
    if (state.isOpen) {
      throw new Error(`Circuit breaker open for ${key}`)
    }

    try {
      await next()
      // Success - reset failure count
      if (state.failures > 0) {
        state.failures = 0
        logger('Circuit breaker failures reset for %s', key)
      }
    } catch (error) {
      state.failures++
      state.lastFailure = now

      if (state.failures >= threshold) {
        state.isOpen = true
        logger('Circuit breaker opened for %s (failures: %d)', key, state.failures)
      }

      throw error
    }
  }
}

/**
 * Create a composite middleware from multiple middlewares
 */
export function composeMiddleware(...middlewares: EventMiddleware[]): EventMiddleware {
  return async (event, next) => {
    let index = 0

    const dispatch = async (): Promise<void> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++]
        if (middleware !== undefined) {
          await middleware(event, dispatch)
        }
      } else {
        await next()
      }
    }

    await dispatch()
  }
}

/**
 * Create default middleware stack
 */
export function createDefaultMiddleware(): EventMiddleware[] {
  return [
    validationMiddleware,
    errorHandlingMiddleware,
    loggingMiddleware,
    deduplicationMiddleware(1000),
    rateLimitingMiddleware(1000)
  ]
}