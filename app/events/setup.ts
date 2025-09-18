/**
 * Event system setup and initialization
 */

import { EventBusWithMiddleware } from './middleware.js'
import {
  loggingMiddleware,
  metricsMiddleware,
  errorHandlingMiddleware,
  rateLimitingMiddleware,
  deduplicationMiddleware
} from './middleware.js'
import { createAuthHandlers, createAuthValidationHandler, createAuthMetricsHandler } from './handlers/auth-handler.js'
import { createConnectionHandlers, createConnectionHealthHandler, createConnectionMetricsHandler } from './handlers/connection-handler.js'
import { createTerminalHandlers, createTerminalBufferHandler, createTerminalMetricsHandler } from './handlers/terminal-handler.js'
import { createSystemHandlers, createCrashRecoveryHandler, createPerformanceHandler } from './handlers/system-handler.js'
import type { Container } from '../services/container.js'
import type { AuthService, SSHService, TerminalService } from '../services/interfaces.js'
import type { SessionStore } from '../state/store.js'
import type { Config } from '../types/config.js'
import debug from 'debug'

const logger = debug('webssh2:events:setup')

/**
 * Event system configuration
 */
export interface EventSystemConfig {
  enableLogging?: boolean
  enableMetrics?: boolean
  enableDeduplication?: boolean
  enableRateLimiting?: boolean
  enablePerformanceMonitoring?: boolean
  enableCrashRecovery?: boolean
  maxEventsPerSecond?: number
  deduplicationWindowMs?: number
  terminalBufferSize?: number
}

/**
 * Event system instance
 */
export interface EventSystem {
  bus: EventBusWithMiddleware
  start(): Promise<void>
  stop(): Promise<void>
  getStats(): Record<string, unknown>
}

/**
 * Create and configure the event system
 */
export function createEventSystem(
  services: Container,
  sessionStore: SessionStore,
  config: Config
): EventSystem {
  const eventConfig: EventSystemConfig = {
    enableLogging: false, // TODO: Add debug option to config if needed
    enableMetrics: false,
    enableDeduplication: true,
    enableRateLimiting: true,
    enablePerformanceMonitoring: false,
    enableCrashRecovery: true,
    maxEventsPerSecond: 1000,
    deduplicationWindowMs: 1000,
    terminalBufferSize: config.session.maxHistorySize ?? 10000
  }

  // Create event bus with middleware support
  const eventBus = new EventBusWithMiddleware({
    maxQueueSize: 10000,
    maxRetries: 3
  })

  // Configure middleware based on settings
  if (eventConfig.enableLogging === true) {
    eventBus.use(loggingMiddleware)
  }

  if (eventConfig.enableMetrics === true) {
    eventBus.use(metricsMiddleware((metric, value, tags) => {
      // Could integrate with actual metrics system here
      logger('Metric: %s = %d, tags: %O', metric, value, tags)
    }))
  }

  if (eventConfig.enableDeduplication === true) {
    eventBus.use(deduplicationMiddleware(eventConfig.deduplicationWindowMs))
  }

  if (eventConfig.enableRateLimiting === true) {
    eventBus.use(rateLimitingMiddleware(eventConfig.maxEventsPerSecond))
  }

  // Always add error handling
  eventBus.use(errorHandlingMiddleware)

  // Register event handlers
  function registerHandlers(): void {
    // Auth handlers
    createAuthHandlers(eventBus, services.resolve<AuthService>('auth'), sessionStore)
    createAuthValidationHandler(eventBus, services.resolve<AuthService>('auth'))
    if (eventConfig.enableMetrics === true) {
      createAuthMetricsHandler(eventBus)
    }

    // Connection handlers
    createConnectionHandlers(eventBus, services.resolve<SSHService>('ssh'), sessionStore)
    createConnectionHealthHandler(eventBus, services.resolve<SSHService>('ssh'))
    if (eventConfig.enableMetrics === true) {
      createConnectionMetricsHandler(eventBus)
    }

    // Terminal handlers
    createTerminalHandlers(
      eventBus,
      services.resolve<TerminalService>('terminal'),
      services.resolve<SSHService>('ssh'),
      sessionStore
    )
    createTerminalBufferHandler(eventBus, eventConfig.terminalBufferSize)
    if (eventConfig.enableMetrics === true) {
      createTerminalMetricsHandler(eventBus)
    }

    // System handlers
    createSystemHandlers(eventBus)
    if (eventConfig.enableCrashRecovery === true) {
      createCrashRecoveryHandler(eventBus)
    }
    if (eventConfig.enablePerformanceMonitoring === true) {
      createPerformanceHandler(eventBus)
    }

    logger('All event handlers registered')
  }

  // Create event system instance
  const eventSystem: EventSystem = {
    bus: eventBus,

    async start(): Promise<void> {
      logger('Starting event system')

      // Register handlers
      registerHandlers()

      // Publish system start event
      await eventBus.publish({
        type: 'system.info',
        payload: {
          message: 'Event system started',
          details: {
            config: eventConfig,
            handlerCounts: eventBus.getStats().handlerCounts
          }
        }
      })

      logger('Event system started successfully')
    },

    async stop(): Promise<void> {
      logger('Stopping event system')

      // Publish system shutdown event
      await eventBus.publish({
        type: 'system.info',
        payload: {
          message: 'Event system shutting down'
        }
      })

      // Wait for pending events
      await eventBus.flush()

      // Clear handlers
      eventBus.clear()
      eventBus.clearMiddleware()

      logger('Event system stopped')
    },

    getStats(): Record<string, unknown> {
      return {
        bus: eventBus.getStats(),
        config: eventConfig
      }
    }
  }

  return eventSystem
}

/**
 * Create a minimal event system for testing
 */
export function createTestEventSystem(): EventSystem {
  const eventBus = new EventBusWithMiddleware({
    maxQueueSize: 100,
    maxRetries: 1
  })

  // Add minimal middleware
  eventBus.use(errorHandlingMiddleware)

  return {
    bus: eventBus,
    start(): Promise<void> {
      logger('Test event system started')
      return Promise.resolve()
    },
    async stop(): Promise<void> {
      await eventBus.flush()
      eventBus.clear()
      logger('Test event system stopped')
    },
    getStats(): Record<string, unknown> {
      return eventBus.getStats()
    }
  }
}

/**
 * Export event bus singleton (for backward compatibility)
 */
export let globalEventBus: EventBusWithMiddleware | null = null

/**
 * Initialize global event bus
 */
export function initializeGlobalEventBus(
  services: Container,
  sessionStore: SessionStore,
  config: Config
): EventBusWithMiddleware {
  if (globalEventBus !== null) {
    logger('Global event bus already initialized')
    return globalEventBus
  }

  const eventSystem = createEventSystem(services, sessionStore, config)
  eventSystem.start().catch(error => {
    logger('Failed to start event system: %O', error)
  })

  globalEventBus = eventSystem.bus
  logger('Global event bus initialized')

  return globalEventBus
}

/**
 * Get or create global event bus
 */
export function getGlobalEventBus(): EventBusWithMiddleware {
  if (globalEventBus === null) {
    throw new Error('Global event bus not initialized')
  }
  return globalEventBus
}

/**
 * Shutdown global event bus
 */
export async function shutdownGlobalEventBus(): Promise<void> {
  if (globalEventBus !== null) {
    await globalEventBus.flush()
    globalEventBus.clear()
    globalEventBus = null
    logger('Global event bus shutdown')
  }
}