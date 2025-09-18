/**
 * Service exports for easy importing
 */

// Service interfaces
export type {
  AuthService,
  SSHService,
  TerminalService,
  SessionService,
  Services,
  Logger,
  ServiceDependencies,
  AuthResult,
  Credentials,
  SSHConfig,
  SSHConnection,
  ShellOptions,
  ExecResult,
  Terminal,
  TerminalOptions,
  Dimensions,
  Session,
  SessionParams
} from './interfaces.js'

// Service implementations
export { AuthServiceImpl } from './auth/auth-service.js'
export { SSHServiceImpl } from './ssh/ssh-service.js'
export { TerminalServiceImpl } from './terminal/terminal-service.js'
export { SessionServiceImpl } from './session/session-service.js'

// Factory functions
export {
  createServices,
  createLogger,
  createSessionStore,
  bootstrapServices,
  createMockServices,
  DefaultLogger
} from './factory.js'
export type { ExtendedServiceDependencies } from './factory.js'

// Dependency injection container
export {
  Container,
  createToken,
  TOKENS
} from './container.js'
export type { Token, Factory, AsyncFactory } from './container.js'

// Setup utilities
export {
  setupContainer,
  setupTestContainer,
  getGlobalContainer,
  initializeGlobalContainer,
  resetGlobalContainer
} from './setup.js'