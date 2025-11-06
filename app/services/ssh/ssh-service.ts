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
import {
  createConnectionId,
  type ConnectionId,
  type SessionId
} from '../../types/branded.js'
import { ok, err, type Result } from '../../state/types.js'
import { Client as SSH2Client, type ClientChannel, type PseudoTtyOptions } from 'ssh2'
import type { SessionStore } from '../../state/store.js'
import debug from 'debug'
import type { Duplex } from 'node:stream'
import { validateConnectionWithDns } from '../../ssh/hostname-resolver.js'
import { ConnectionPool } from './connection-pool.js'
import {
  createConnectionLogger,
  type ConnectionLogBase,
  type ConnectionLogger
} from './connection-logger.js'
import { registerConnectionHandlers } from './connection-handlers.js'
import { executeSshCommand } from './exec-command.js'
import { isAuthMethodAllowed } from '../../auth/auth-method-policy.js'

const logger = debug('webssh2:services:ssh')

export class SSHServiceImpl implements SSHService {
  private readonly pool = new ConnectionPool()
  private readonly connectionTimeout: number
  private readonly keepaliveInterval: number
  private readonly keepaliveCountMax: number
  private readonly connectionLogger: ConnectionLogger
  private readonly keyboardInteractiveAllowed: boolean

  constructor(
    private readonly deps: ServiceDependencies,
    private readonly store: SessionStore
  ) {
    this.connectionTimeout = deps.config.ssh.readyTimeout
    this.keepaliveInterval = deps.config.ssh.keepaliveInterval
    this.keepaliveCountMax = deps.config.ssh.keepaliveCountMax
    const structuredLogger = deps.createStructuredLogger({ namespace: 'webssh2:services:ssh' })
    this.connectionLogger = createConnectionLogger({
      structuredLogger,
      fallbackLogger: deps.logger
    })
    this.keyboardInteractiveAllowed = isAuthMethodAllowed(
      deps.config.ssh.allowedAuthMethods,
      'keyboard-interactive'
    )
    if (!this.keyboardInteractiveAllowed) {
      deps.logger.info('Keyboard-interactive authentication disabled by server policy')
    }
  }

  private buildConnectConfig(config: SSHConfig): Parameters<SSH2Client['connect']>[0] {
    const connectConfig: Parameters<SSH2Client['connect']>[0] = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: config.readyTimeout ?? this.connectionTimeout,
      keepaliveInterval: config.keepaliveInterval ?? this.keepaliveInterval,
      keepaliveCountMax: config.keepaliveCountMax ?? this.keepaliveCountMax,
      tryKeyboard: this.keyboardInteractiveAllowed
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

  /**
   * Connect to SSH server
   */
  async connect(config: SSHConfig): Promise<Result<SSHConnection>> {
    const baseInfo = this.connectionLogger.baseFromConfig(config)
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
          this.connectionLogger.log(baseInfo, 'warn', 'error', 'SSH connection timed out', {
            connectionId,
            status: 'failure',
            reason: 'Connection timeout'
          })
          resolve(err(new Error('Connection timeout')))
        }, this.connectionTimeout)

        this.setupKeyboardInteractiveHandler(client, config)
        registerConnectionHandlers(
          {
            pool: this.pool,
            store: this.store,
            connectionLogger: this.connectionLogger,
            debug: logger
          },
          {
            client,
            connection,
            config,
            timeout,
            onReady: () => resolve(ok(connection)),
            onError: (error) => resolve(err(error))
          }
        )

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
        this.connectionLogger.log(baseInfo, 'error', 'error', 'SSH connection setup failed', {
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
      this.connectionLogger.log(
        baseInfo,
        'warn',
        'policy_block',
        'SSH connection blocked by subnet policy',
        {
          status: 'failure',
          reason: errorMessage
        }
      )
      return err(new Error(errorMessage))
    }

    logger(`Host validation failed: ${validationResult.error.message}`)
    this.connectionLogger.log(
      baseInfo,
      'error',
      'error',
      'SSH connection validation failed',
      {
        status: 'failure',
        reason: validationResult.error.message
      }
    )
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

  exec(connectionId: ConnectionId, command: string): Promise<Result<ExecResult>> {
    return executeSshCommand(
      {
        pool: this.pool,
        connectionLogger: this.connectionLogger,
        debug: logger
      },
      { connectionId, command }
    )
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

}
