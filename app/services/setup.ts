/**
 * Service container setup and initialization
 */

import type { Config } from '../types/config.js'
import { Container, TOKENS } from './container.js'
import {
  createLogger,
  createSessionStore,
  createServices
} from './factory.js'
import type { ExtendedServiceDependencies } from './factory.js'
import debug from 'debug'
import { createAppStructuredLogger } from '../logger.js'
import type { StructuredLogger, StructuredLoggerOptions } from '../logging/structured-logger.js'

const logger = debug('webssh2:services:setup')

/**
 * Setup and configure the dependency injection container
 */
export function setupContainer(config: Config): Container {
  logger('Setting up service container')
  
  const container = new Container()

  // Register config as singleton
  container.registerSingleton(TOKENS.Config, config)

  // Register logger factory
  container.register(TOKENS.Logger, () => {
    logger('Creating logger')
    return createLogger(config)
  })

  // Register session store factory
  container.register(TOKENS.SessionStore, () => {
    logger('Creating session store')
    return createSessionStore(config)
  })

  // Register individual service factories
  container.register(TOKENS.AuthService, () => {
    logger('Creating auth service')
    const deps = createDependencies(container)
    return createServices(deps).auth
  })

  container.register(TOKENS.SSHService, () => {
    logger('Creating SSH service')
    const deps = createDependencies(container)
    return createServices(deps).ssh
  })

  container.register(TOKENS.TerminalService, () => {
    logger('Creating terminal service')
    const deps = createDependencies(container)
    return createServices(deps).terminal
  })

  container.register(TOKENS.SessionService, () => {
    logger('Creating session service')
    const deps = createDependencies(container)
    return createServices(deps).session
  })

  // Register all services together
  container.register(TOKENS.Services, () => {
    logger('Creating all services')
    const deps = createDependencies(container)
    return createServices(deps)
  })

  logger('Container setup complete')
  return container
}

/**
 * Helper to create service dependencies from container
 */
function createDependencies(container: Container): ExtendedServiceDependencies {
  const createStructuredLogger = (options: StructuredLoggerOptions = {}): StructuredLogger => {
    const namespace = options.namespace ?? 'webssh2:services'
    return createAppStructuredLogger({
      ...options,
      namespace
    })
  }

  return {
    config: container.resolve(TOKENS.Config),
    logger: container.resolve(TOKENS.Logger),
    store: container.resolve(TOKENS.SessionStore),
    createStructuredLogger
  }
}

/**
 * Create a test container with mock dependencies
 */
export function setupTestContainer(config?: Partial<Config>): Container {
  const testConfig: Config = {
    allowedSubnets: [],
    session: {
      sessionTimeout: 3600000,
      maxHistorySize: 100
    },
    ssh: {
      host: 'localhost',
      port: 22,
      readyTimeout: 20000,
      keepaliveInterval: 30000,
      term: 'xterm-256color'
    },
    terminal: {
      rows: 24,
      cols: 80,
      term: 'xterm-256color'
    },
    logging: {
      namespace: 'webssh2:test'
    },
    safeShutdownDuration: 5000,
    ...config
  } as Config

  return setupContainer(testConfig)
}

/**
 * Global container instance (singleton)
 */
let globalContainer: Container | null = null

/**
 * Get the global container instance
 */
export function getGlobalContainer(): Container | null {
  return globalContainer
}

/**
 * Initialize the global container
 */
export function initializeGlobalContainer(config: Config): Container {
  if (globalContainer !== null) {
    logger('Global container already initialized')
    return globalContainer
  }

  logger('Initializing global container')
  globalContainer = setupContainer(config)
  return globalContainer
}

/**
 * Reset the global container (mainly for testing)
 */
export function resetGlobalContainer(): void {
  logger('Resetting global container')
  if (globalContainer !== null) {
    globalContainer.clear()
    globalContainer = null
  }
}
