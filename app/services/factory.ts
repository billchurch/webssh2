/**
 * Service factory for creating and wiring up all services
 */

import type { Config } from '../types/config.js'
import type {
  Services,
  ServiceDependencies,
  Logger,
  AuthResult,
  SSHConnection,
  Terminal,
  Session
} from './interfaces.js'
import { AuthServiceImpl } from './auth/auth-service.js'
import { SSHServiceImpl } from './ssh/ssh-service.js'
import { TerminalServiceImpl } from './terminal/terminal-service.js'
import { SessionServiceImpl } from './session/session-service.js'
import { createSftpService, type SftpServiceDependencies } from './sftp/sftp-service.js'
import { createShellFileService } from './sftp/shell-file-service.js'
import { SessionStore } from '../state/store.js'
import { createSessionId, createUserId, createConnectionId } from '../types/branded.js'
import { createInitialState } from '../state/types.js'
import { Client as SSH2Client } from 'ssh2'
import type { Duplex } from 'node:stream'
import debug from 'debug'
import { createAppStructuredLogger } from '../logger.js'
import type { StructuredLogger, StructuredLoggerOptions } from '../logging/structured-logger.js'
import { DEFAULT_SFTP_CONFIG } from '../config/default-config.js'
import { HostKeyService } from './host-key/host-key-service.js'
import { resolveHostKeyMode } from '../config/config-processor.js'

const factoryLogger = debug('webssh2:services:factory')

/**
 * Default logger implementation
 */
export class DefaultLogger implements Logger {
  private readonly debugLogger: debug.Debugger

  constructor(namespace: string = 'webssh2') {
    this.debugLogger = debug(namespace)
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta === undefined) {
      this.debugLogger(message)
    } else {
      this.debugLogger(message, meta)
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta === undefined) {
      this.debugLogger('[INFO]', message)
    } else {
      this.debugLogger('[INFO]', message, meta)
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta === undefined) {
      this.debugLogger('[WARN]', message)
    } else {
      this.debugLogger('[WARN]', message, meta)
    }
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    if (error === undefined && meta === undefined) {
      this.debugLogger('[ERROR]', message)
    } else if (error === undefined) {
      this.debugLogger('[ERROR]', message, meta)
    } else if (meta === undefined) {
      this.debugLogger('[ERROR]', message, error.message, error.stack)
    } else {
      this.debugLogger('[ERROR]', message, error.message, error.stack, meta)
    }
  }
}

/**
 * Extended service dependencies including store
 */
export interface ExtendedServiceDependencies extends ServiceDependencies {
  store: SessionStore
}

/**
 * Create all services with dependencies
 */
export function createServices(
  deps: ExtendedServiceDependencies
): Services {
  factoryLogger('Creating services')

  // Create service implementations
  const auth = new AuthServiceImpl(deps, deps.store)
  const ssh = new SSHServiceImpl(deps, deps.store)
  const terminal = new TerminalServiceImpl(deps, deps.store)
  const session = new SessionServiceImpl(deps, deps.store)

  // Create file service (SFTP or shell backend) if configured
  const sftpConfig = deps.config.ssh.sftp ?? DEFAULT_SFTP_CONFIG
  const sftpDeps: SftpServiceDependencies = {
    getSSHClient: (connectionId) => {
      const result = ssh.getConnectionStatus(connectionId)
      if (result.ok && result.value !== null) {
        return result.value.client
      }
      return undefined
    }
  }
  const sftp = sftpConfig.backend === 'shell'
    ? createShellFileService(sftpConfig, sftpDeps)
    : createSftpService(sftpConfig, sftpDeps)

  // Create host key service if configured
  const hostKeyConfig = resolveHostKeyMode(deps.config.ssh.hostKeyVerification)
  const hostKey = hostKeyConfig.enabled ? new HostKeyService(hostKeyConfig) : undefined

  const services: Services = {
    auth,
    ssh,
    terminal,
    session,
    sftp,
  }

  if (hostKey !== undefined) {
    services.hostKey = hostKey
  }

  factoryLogger('Services created successfully')
  return services
}

/**
 * Create a logger instance
 */
export function createLogger(
  config: Config,
  namespace?: string
): Logger {
  // Use provided namespace or get from config
  const logNamespace = namespace ?? config.logging?.namespace ?? 'webssh2'
  return new DefaultLogger(logNamespace)
}

export function createServiceStructuredLogger(
  config: Config,
  options: StructuredLoggerOptions = {}
): StructuredLogger {
  const namespace = options.namespace ?? 'webssh2:services'
  return createAppStructuredLogger({
    ...options,
    namespace,
    config
  })
}

/**
 * Create a session store
 */
export function createSessionStore(config: Config): SessionStore {
  const maxHistorySize = config.session.maxHistorySize ?? 100
  return new SessionStore({ maxHistorySize })
}

/**
 * Bootstrap all services and dependencies
 */
export function bootstrapServices(config: Config): {
  services: Services
  store: SessionStore
  logger: Logger
} {
  factoryLogger('Bootstrapping services')

  // Create core dependencies
  const logger = createLogger(config)
  const store = createSessionStore(config)

  // Create extended dependencies
  const deps: ExtendedServiceDependencies = {
    config,
    logger,
    store,
    createStructuredLogger: (options) => createServiceStructuredLogger(config, options)
  }

  // Create services
  const services = createServices(deps)

  factoryLogger('Bootstrap complete')
  return {
    services,
    store,
    logger
  }
}

/**
 * Create mock services for testing
 * Note: Import vi from vitest when using this function
 */
export function createMockServices(): Services {
  const mockAuthResult: AuthResult = {
    sessionId: createSessionId('test-session'),
    userId: createUserId('test-user'),
    username: 'testuser',
    method: 'manual',
    expiresAt: Date.now() + 86400000
  }

  const mockSSHConnection: SSHConnection = {
    id: createConnectionId('test-conn'),
    sessionId: createSessionId('test-session'),
    client: new SSH2Client(),
    status: 'connected',
    createdAt: Date.now(),
    lastActivity: Date.now(),
    host: 'mock-host',
    port: 22,
    username: 'testuser'
  }

  const mockTerminal: Terminal = {
    id: 'test-terminal',
    sessionId: createSessionId('test-session'),
    term: 'xterm-256color',
    rows: 24,
    cols: 80,
    env: {}
  }

  const mockSession: Session = {
    id: createSessionId('test-session'),
    state: createInitialState(createSessionId('test-session')),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const mockStream = {} as Duplex

  const mockAuthService: Services['auth'] = {
    authenticate: () => Promise.resolve({ ok: true, value: mockAuthResult }),
    validateSession: () => ({ ok: true, value: true }),
    revokeSession: () => Promise.resolve({ ok: true, value: undefined }),
    getSessionInfo: () => ({ ok: true, value: null })
  }

  const mockSSHService: Services['ssh'] = {
    connect: () => Promise.resolve({ ok: true, value: mockSSHConnection }),
    shell: () => Promise.resolve({ ok: true, value: mockStream }),
    exec: () => Promise.resolve({ ok: true, value: { stdout: '', stderr: '', code: 0 } }),
    disconnect: () => Promise.resolve({ ok: true, value: undefined }),
    getConnectionStatus: () => ({ ok: true, value: null })
  }

  const mockTerminalService: Services['terminal'] = {
    create: () => ({ ok: true, value: mockTerminal }),
    resize: () => ({ ok: true, value: undefined }),
    write: () => ({ ok: true, value: undefined }),
    destroy: () => ({ ok: true, value: undefined }),
    getTerminal: () => ({ ok: true, value: null })
  }

  const mockSessionService: Services['session'] = {
    create: () => ({ ok: true, value: mockSession }),
    get: () => ({ ok: true, value: null }),
    update: () => ({ ok: true, value: mockSession }),
    delete: () => ({ ok: true, value: undefined }),
    list: () => ({ ok: true, value: [] })
  }

  return {
    auth: mockAuthService,
    ssh: mockSSHService,
    terminal: mockTerminalService,
    session: mockSessionService
  }
}
