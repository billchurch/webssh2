/**
 * SSH service implementation
 */

import { randomUUID } from 'node:crypto'
import type {
  SSHService,
  SSHConfig,
  SSHConnection,
  ShellOptions,
  ExecResult,
  ServiceDependencies
} from '../interfaces.js'
import type { ConnectionId, SessionId } from '../../types/branded.js'
import type { Result } from '../../state/types.js'
import { ok, err } from '../../state/types.js'
import { createConnectionId } from '../../types/branded.js'
import { Client as SSH2Client } from 'ssh2'
import type { SessionStore } from '../../state/store.js'
import debug from 'debug'
import type { Duplex } from 'node:stream'
import type { PseudoTtyOptions, ClientChannel } from 'ssh2'
import { validateConnectionWithDns } from '../../ssh/hostname-resolver.js'
import { ConnectionPool } from './connection-pool.js'
import type { StructuredLogger } from '../../logging/structured-logger.js'
import type { StructuredLogInput } from '../../logging/structured-log.js'
import type { LogLevel } from '../../logging/levels.js'
import type { LogEventName } from '../../logging/event-catalog.js'
import type { LogContext, LogStatus, LogSubsystem } from '../../logging/log-context.js'

const logger = debug('webssh2:services:ssh')

interface ConnectionHandlerParams {
  client: SSH2Client
  connection: SSHConnection
  config: SSHConfig
  timeout: ReturnType<typeof setTimeout>
  onReady: () => void
  onError: (error: Error) => void
}

interface ConnectionLogBase {
  readonly sessionId: SessionId
  readonly host: string
  readonly port: number
  readonly username?: string | undefined
}

interface ConnectionLogDetails {
  readonly connectionId?: ConnectionId
  readonly status?: LogStatus
  readonly reason?: string | undefined
  readonly errorCode?: string | number | undefined
  readonly durationMs?: number
  readonly bytesIn?: number
  readonly bytesOut?: number
  readonly subsystem?: LogSubsystem
  readonly data?: Record<string, unknown>
}

export class SSHServiceImpl implements SSHService {
  private readonly pool = new ConnectionPool()
  private readonly connectionTimeout: number
  private readonly keepaliveInterval: number
  private readonly keepaliveCountMax: number
  private readonly structuredLogger: StructuredLogger

  constructor(
    private readonly deps: ServiceDependencies,
    private readonly store: SessionStore
  ) {
    this.connectionTimeout = deps.config.ssh.readyTimeout
    this.keepaliveInterval = deps.config.ssh.keepaliveInterval
    this.keepaliveCountMax = deps.config.ssh.keepaliveCountMax
    this.structuredLogger = deps.createStructuredLogger({ namespace: 'webssh2:services:ssh' })
  }

    private buildConnectConfig(config: SSHConfig): Parameters<SSH2Client['connect']>[0] {
    const connectConfig: Parameters<SSH2Client['connect']>[0] = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: config.readyTimeout ?? this.connectionTimeout,
      keepaliveInterval: config.keepaliveInterval ?? this.keepaliveInterval,
      keepaliveCountMax: config.keepaliveCountMax ?? this.keepaliveCountMax,
      tryKeyboard: true // Enable keyboard-interactive authentication
    }

    // Add authentication method
    if (config.password !== undefined && config.password !== '') {
      connectConfig.password = config.password
      logger('Password authentication configured')
    } else if (config.privateKey !== undefined && config.privateKey !== '') {
      connectConfig.privateKey = config.privateKey
      logger('Private key authentication configured')
      if (config.passphrase !== undefined && config.passphrase !== '') {
        connectConfig.passphrase = config.passphrase
        logger('Passphrase configured for private key')
      }
    } else {
      logger('WARNING: No authentication method configured (no password or private key)')
    }

    if (config.algorithms !== undefined) {
      connectConfig.algorithms = config.algorithms
    }

    return connectConfig
  }

    private setupKeyboardInteractiveHandler(client: SSH2Client, config: SSHConfig): void {
    client.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      logger('Keyboard-interactive authentication requested')
      logger('Prompts:', prompts.map(p => ({ prompt: p.prompt, echo: p.echo })))

      if (config.password !== undefined && config.password !== '' && prompts.length > 0) {
        const responses = prompts.map(prompt => {
          if (prompt.prompt.toLowerCase().includes('password')) {
            logger('Responding to password prompt')
            return config.password as string // We've already checked it's defined and not empty
          }
          logger(`Unknown prompt: ${prompt.prompt}`)
          return '' // Empty response for unknown prompts
        })
        finish(responses)
      } else {
        logger('No password available for keyboard-interactive')
        finish([])
      }
    })
  }

    private setupConnectionHandlers({
    client,
    connection,
    config,
    timeout,
    onReady,
    onError
  }: ConnectionHandlerParams): void {
    client.on('ready', () => {
      clearTimeout(timeout)
      logger('SSH connection ready')

      connection.status = 'connected'
      connection.lastActivity = Date.now()
      this.pool.add(connection)

      this.store.dispatch(config.sessionId, {
        type: 'CONNECTION_ESTABLISHED',
        payload: { connectionId: connection.id }
      })

      this.logConnection(
        this.createLogBaseFromConnection(connection),
        'info',
        'session_start',
        'SSH connection established',
        {
          connectionId: connection.id,
          status: 'success',
          durationMs: Date.now() - connection.createdAt
        }
      )

      onReady()
    })

    client.on('error', (error: Error & { level?: string }) => {
      clearTimeout(timeout)
      logger('SSH connection error:', error.message)
      logger('SSH error details:', {
        message: error.message,
        level: error.level,
        stack: error.stack
      })

      connection.status = 'error'

      this.store.dispatch(config.sessionId, {
        type: 'CONNECTION_ERROR',
        payload: { error: error.message }
      })

      this.logConnection(
        this.createLogBaseFromConnection(connection),
        'error',
        'error',
        'SSH connection error',
        {
          connectionId: connection.id,
          status: 'failure',
          reason: error.message,
          errorCode: error.level
        }
      )

      onError(error)
    })

    client.on('close', () => {
      logger('SSH connection closed')
      this.pool.remove(connection.id)

      this.store.dispatch(config.sessionId, {
        type: 'CONNECTION_CLOSED',
        payload: {}
      })

      const status: LogStatus = connection.status === 'error' ? 'failure' : 'success'
      this.logConnection(
        this.createLogBaseFromConnection(connection),
        'info',
        'session_end',
        'SSH connection closed',
        {
          connectionId: connection.id,
          status,
          durationMs: Date.now() - connection.createdAt
        }
      )
    })
  }

  /**
   * Connect to SSH server
   */
  async connect(config: SSHConfig): Promise<Result<SSHConnection>> {
    const baseInfo = this.createLogBaseFromConfig(config)
    const validationResult = await this.validateConnectionAgainstSubnets(config, baseInfo)
    if (!validationResult.ok) {
      return err(validationResult.error)
    }

    return new Promise((resolve) => {
      try {
        logger('Connecting to SSH server:', config.host, config.port)

        const client = new SSH2Client()
        const connectionId = createConnectionId(randomUUID())

        const connection: SSHConnection = {
          id: connectionId,
          sessionId: config.sessionId,
          client,
          status: 'connecting',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          host: config.host,
          port: config.port,
          username: config.username
        }

        const timeout = setTimeout(() => {
          client.end()
          this.logConnection(baseInfo, 'warn', 'error', 'SSH connection timed out', {
            connectionId,
            status: 'failure',
            reason: 'Connection timeout'
          })
          resolve(err(new Error('Connection timeout')))
        }, this.connectionTimeout)

        this.setupKeyboardInteractiveHandler(client, config)
        this.setupConnectionHandlers({
          client,
          connection,
          config,
          timeout,
          onReady: () => resolve(ok(connection)),
          onError: (error) => resolve(err(error))
        })

        const connectConfig = this.buildConnectConfig(config)

        logger('SSH2 client connect config:', {
          host: connectConfig.host,
          port: connectConfig.port,
          username: connectConfig.username,
          hasPassword: 'password' in connectConfig,
          hasPrivateKey: 'privateKey' in connectConfig,
          hasPassphrase: 'passphrase' in connectConfig,
          algorithms: connectConfig.algorithms === undefined ? 'default' : 'configured',
          readyTimeout: connectConfig.readyTimeout,
          keepaliveInterval: connectConfig.keepaliveInterval,
          keepaliveCountMax: connectConfig.keepaliveCountMax,
          tryKeyboard: connectConfig.tryKeyboard
        })

        client.connect(connectConfig)
      } catch (error) {
        logger('Failed to connect:', error)
        const failure = error instanceof Error ? error : new Error('Connection failed')
        this.logConnection(baseInfo, 'error', 'error', 'SSH connection setup failed', {
          status: 'failure',
          reason: failure.message
        })
        resolve(err(failure))
      }
    })
  }

  
  private async validateConnectionAgainstSubnets(
    config: SSHConfig,
    baseInfo: ConnectionLogBase
  ): Promise<Result<void>> {
    const allowedSubnets = this.deps.config.ssh.allowedSubnets
    if (allowedSubnets == null || allowedSubnets.length === 0) {
      return ok(undefined)
    }

    logger(`Validating connection to ${config.host} against subnet restrictions`)
    const validationResult = await validateConnectionWithDns(config.host, allowedSubnets)

    if (validationResult.ok) {
      if (validationResult.value) {
        logger(`Host ${config.host} passed subnet validation`)
        return ok(undefined)
      }

      const errorMessage = `Connection to host ${config.host} is not permitted`
      logger(`Host ${config.host} is not in allowed subnets: ${allowedSubnets.join(', ')}`)
      this.logConnection(baseInfo, 'warn', 'policy_block', 'SSH connection blocked by subnet policy', {
        status: 'failure',
        reason: errorMessage
      })
      return err(new Error(errorMessage))
    }

    logger(`Host validation failed: ${validationResult.error.message}`)
    this.logConnection(baseInfo, 'error', 'error', 'SSH connection validation failed', {
      status: 'failure',
      reason: validationResult.error.message
    })
    return err(validationResult.error)
  }

  async shell(connectionId: ConnectionId, options: ShellOptions): Promise<Result<Duplex>> {
    return new Promise((resolve) => {
      try {
        const connection = this.pool.get(connectionId)
        if (connection === undefined) {
          resolve(err(new Error('Connection not found')))
          return
        }

        if (connection.status !== 'connected') {
          resolve(err(new Error('Connection not ready')))
          return
        }

        logger('Opening shell for connection:', connectionId)
        logger('Shell options provided:', {
          term: options.term,
          cols: options.cols,
          rows: options.rows,
          hasEnv: options.env !== undefined
        })

        const ptyOptions: PseudoTtyOptions = {
          term: options.term ?? 'xterm-256color',
          cols: options.cols ?? 80,
          rows: options.rows ?? 24
        }

        logger('Final shell PTY options:', {
          term: ptyOptions.term,
          cols: ptyOptions.cols,
          rows: ptyOptions.rows
        })

        // Environment variables should be passed as second parameter
        const envOptions = options.env === undefined ? {} : { env: options.env }

        logger('Shell environment options:', {
          hasEnv: options.env !== undefined,
          envKeys: options.env === undefined ? [] : Object.keys(options.env),
          env: options.env
        })

        // Pass PTY and env options as separate parameters like v1
        connection.client.shell(ptyOptions, envOptions, (error: Error | undefined, stream: ClientChannel) => {
          if (error !== undefined) {
            logger('Failed to open shell:', error)
            resolve(err(error))
            return
          }

          connection.lastActivity = Date.now()
          logger('Shell opened successfully')

          // Log what the stream thinks its window size is
          if ('rows' in stream && 'cols' in stream) {
            logger('Stream window size:', { rows: stream.rows, cols: stream.cols })
          }

          resolve(ok(stream))
        })

      } catch (error) {
        logger('Failed to open shell:', error)
        resolve(err(error instanceof Error ? error : new Error('Shell failed')))
      }
    })
  }

    async exec(connectionId: ConnectionId, command: string): Promise<Result<ExecResult>> {
    return new Promise((resolve) => {
      try {
        const connection = this.pool.get(connectionId)
        if (connection === undefined) {
          resolve(err(new Error('Connection not found')))
          return
        }

        if (connection.status !== 'connected') {
          this.logConnection(this.createLogBaseFromConnection(connection), 'warn', 'ssh_command', 'SSH exec command rejected', {
            connectionId: connection.id,
            status: 'failure',
            subsystem: 'exec',
            reason: 'Connection not ready',
            data: { command }
          })
          resolve(err(new Error('Connection not ready')))
          return
        }

        logger('Executing command:', command)
        const baseInfo = this.createLogBaseFromConnection(connection)
        const start = Date.now()

        let stdout = ''
        let stderr = ''

        connection.client.exec(command, (error: Error | undefined, stream: ClientChannel) => {
          if (error !== undefined) {
            logger('Failed to execute command:', error)
            this.logConnection(baseInfo, 'warn', 'ssh_command', 'SSH exec command failed to start', {
              connectionId: connection.id,
              status: 'failure',
              subsystem: 'exec',
              reason: error.message,
              data: { command }
            })
            resolve(err(error))
            return
          }

          stream.on('data', (data: Buffer) => {
            stdout += data.toString()
          })

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString()
          })

          stream.on('close', (code: number) => {
            connection.lastActivity = Date.now()
            logger('Command executed with code:', code)

            const status: LogStatus = code === 0 ? 'success' : 'failure'
            const level: LogLevel = status === 'success' ? 'info' : 'warn'
            const reason = status === 'failure' ? `Command exited with code ${code}` : undefined

            this.logConnection(baseInfo, level, 'ssh_command', 'SSH exec command completed', {
              connectionId: connection.id,
              status,
              subsystem: 'exec',
              durationMs: Date.now() - start,
              bytesIn: Buffer.byteLength(command),
              bytesOut: Buffer.byteLength(stdout) + Buffer.byteLength(stderr),
              reason,
              data: {
                command,
                exit_code: code
              }
            })

            resolve(ok({ stdout, stderr, code }))
          })
        })
      } catch (error) {
        logger('Failed to execute command:', error)
        const failure = error instanceof Error ? error : new Error('Exec failed')
        const connection = this.pool.get(connectionId)
        if (connection !== undefined) {
          this.logConnection(this.createLogBaseFromConnection(connection), 'error', 'ssh_command', 'SSH exec command threw error', {
            connectionId: connection.id,
            status: 'failure',
            subsystem: 'exec',
            reason: failure.message,
            data: { command }
          })
        }
        resolve(err(failure))
      }
    })
  }


  disconnect(connectionId: ConnectionId): Promise<Result<void>> {
    try {
      const connection = this.pool.get(connectionId)
      if (connection === undefined) {
        return Promise.resolve(ok(undefined))
      }

      logger('Disconnecting:', connectionId)
      
      // Close SSH client
      connection.client.end()
      
      // Remove from pool
      this.pool.remove(connectionId)
      
      // Update store state
      this.store.dispatch(connection.sessionId, {
        type: 'CONNECTION_CLOSED',
        payload: {}
      })

      return Promise.resolve(ok(undefined))
    } catch (error) {
      logger('Failed to disconnect:', error)
      return Promise.resolve(err(error instanceof Error ? error : new Error('Disconnect failed')))
    }
  }

    getConnectionStatus(connectionId: ConnectionId): Result<SSHConnection | null> {
    const connection = this.pool.get(connectionId)
    return ok(connection ?? null)
  }

    async disconnectSession(sessionId: SessionId): Promise<void> {
    const connections = this.pool.getBySession(sessionId)
    for (const connection of connections) {
      await this.disconnect(connection.id)
    }
  }


    cleanup(): void {
    logger('Cleaning up all connections')
    this.pool.clear()
  }

  private createLogBaseFromConfig(config: SSHConfig): ConnectionLogBase {
    return {
      sessionId: config.sessionId,
      host: config.host,
      port: config.port,
      username: config.username
    }
  }

  private createLogBaseFromConnection(connection: SSHConnection): ConnectionLogBase {
    return {
      sessionId: connection.sessionId,
      host: connection.host,
      port: connection.port,
      username: connection.username
    }
  }

  private logConnection(
    base: ConnectionLogBase,
    level: LogLevel,
    event: LogEventName,
    message: string,
    details: ConnectionLogDetails = {}
  ): void {
    const context: LogContext = {
      sessionId: base.sessionId,
      protocol: 'ssh',
      subsystem: details.subsystem ?? 'shell',
      targetHost: base.host,
      targetPort: base.port,
      ...(base.username !== undefined && base.username !== '' ? { username: base.username } : {}),
      ...(details.connectionId !== undefined ? { connectionId: details.connectionId } : {}),
      ...(details.status !== undefined ? { status: details.status } : {}),
      ...(details.reason !== undefined ? { reason: details.reason } : {}),
      ...(details.errorCode !== undefined ? { errorCode: details.errorCode } : {}),
      ...(details.durationMs !== undefined ? { durationMs: details.durationMs } : {}),
      ...(details.bytesIn !== undefined ? { bytesIn: details.bytesIn } : {}),
      ...(details.bytesOut !== undefined ? { bytesOut: details.bytesOut } : {})
    }

    const entry: Omit<StructuredLogInput, 'level'> = {
      event,
      message,
      context,
      ...(details.data !== undefined ? { data: { ...details.data } } : {})
    }

    this.emitStructuredLog(level, entry)
  }

  private emitStructuredLog(level: LogLevel, entry: Omit<StructuredLogInput, 'level'>): void {
    type StructuredResult = ReturnType<StructuredLogger['info']>
    const logResult: StructuredResult = (() => {
      switch (level) {
        case 'debug':
          return this.structuredLogger.debug(entry)
        case 'info':
          return this.structuredLogger.info(entry)
        case 'warn':
          return this.structuredLogger.warn(entry)
        case 'error':
          return this.structuredLogger.error(entry)
        default:
          return this.structuredLogger.info(entry)
      }
    })()

    if (!logResult.ok) {
      const reason =
        logResult.error instanceof Error ? logResult.error.message : String(logResult.error)
      this.deps.logger.warn('Failed to emit structured SSH log', { error: reason })
    }
  }
}
