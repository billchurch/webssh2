/**
 * Simple event system setup for services integration
 */

import {
  EventBusWithMiddleware,
  loggingMiddleware,
  metricsMiddleware,
  deduplicationMiddleware,
  rateLimitingMiddleware
} from './middleware.js'
import { createAuthHandlers } from './handlers/auth-handler.js'
import { createConnectionHandlers } from './handlers/connection-handler.js'
import { createTerminalHandlers } from './handlers/terminal-handler.js'
import { createSystemHandlers } from './handlers/system-handler.js'
import type { Services } from '../services/interfaces.js'
import type { SessionStore } from '../state/store.js'
import type { Config } from '../types/config.js'
import type { EventBus } from './event-bus.js'
import debug from 'debug'

const logger = debug('webssh2:events:setup-simple')

/**
 * Event system with bus property
 */
export interface EventSystemWithBus {
  eventBus: EventBus
  start(): Promise<void>
  stop(): Promise<void>
}

/**
 * Setup event system with services
 */
export function setupEventSystem(
  services: Services,
  store: SessionStore,
  _config: Config
): EventSystemWithBus {
  logger('Setting up event system')

  // Create event bus with middleware
  const eventBus = new EventBusWithMiddleware({
    maxQueueSize: 10000,
    maxRetries: 3
  })

  // Add middleware based on environment
  if (process.env['DEBUG']?.includes('webssh2:events') === true) {
    eventBus.use(loggingMiddleware)
  }

  // Always enable these for production stability
  eventBus.use(deduplicationMiddleware(1000))
  eventBus.use(rateLimitingMiddleware(1000))

  // Optionally enable metrics
  if (process.env['WEBSSH2_ENABLE_METRICS'] === 'true') {
    eventBus.use(metricsMiddleware())
  }

  // Register event handlers
  const registerHandlers = (): void => {
    logger('Registering event handlers')

    // Auth handlers
    createAuthHandlers(eventBus, services.auth, store)

    // Connection handlers
    createConnectionHandlers(eventBus, services.ssh, store)

    // Terminal handlers
    createTerminalHandlers(eventBus, services.terminal, services.ssh, store)

    // System handlers
    createSystemHandlers(eventBus)

    logger('Event handlers registered')
  }

  return {
    eventBus,

    async start(): Promise<void> {
      logger('Starting event system')
      registerHandlers()

      await eventBus.publish({
        type: 'system.info',
        payload: {
          message: 'Event system started',
          details: {
            handlers: eventBus.getStats().handlerCounts
          }
        }
      })

      logger('Event system started')
    },

    async stop(): Promise<void> {
      logger('Stopping event system')

      await eventBus.publish({
        type: 'system.info',
        payload: {
          message: 'Event system stopping'
        }
      })

      await eventBus.flush()
      eventBus.clear()
      eventBus.clearMiddleware()

      logger('Event system stopped')
    }
  }
}