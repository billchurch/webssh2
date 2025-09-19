/**
 * Event system exports
 */

// Core types
export type {
  AppEvent,
  AuthEvent,
  ConnectionEvent,
  TerminalEvent,
  SessionEvent,
  SystemEvent,
  RecordingEvent,
  EventType,
  EventPayload,
  EventWithMetadata
} from './types.js'

export {
  EventPriority,
  isEventType
} from './types.js'

// Event bus
export type {
  EventHandler,
  Unsubscribe,
  EventFilter,
  SubscriptionOptions,
  EventBusStats
} from './event-bus.js'

export {
  EventBus
} from './event-bus.js'

// Middleware
export type {
  EventMiddleware,
  EventContext
} from './middleware.js'

export {
  EventBusWithMiddleware,
  loggingMiddleware,
  metricsMiddleware,
  errorHandlingMiddleware,
  rateLimitingMiddleware,
  filteringMiddleware,
  deduplicationMiddleware,
  validationMiddleware,
  circuitBreakerMiddleware,
  composeMiddleware,
  createDefaultMiddleware
} from './middleware.js'

// Setup
export type {
  EventSystemConfig,
  EventSystem
} from './setup.js'

export {
  createEventSystem,
  createTestEventSystem,
  initializeGlobalEventBus,
  getGlobalEventBus,
  shutdownGlobalEventBus
} from './setup.js'

// Handlers (for testing or custom setup)
export {
  createAuthHandlers,
  createAuthValidationHandler,
  createAuthMetricsHandler
} from './handlers/auth-handler.js'

export {
  createConnectionHandlers,
  createConnectionHealthHandler,
  createConnectionMetricsHandler
} from './handlers/connection-handler.js'

export {
  createTerminalHandlers,
  createTerminalBufferHandler,
  createTerminalMetricsHandler
} from './handlers/terminal-handler.js'

export {
  createSystemHandlers,
  createCrashRecoveryHandler,
  createPerformanceHandler
} from './handlers/system-handler.js'