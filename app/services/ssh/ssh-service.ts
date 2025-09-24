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

const logger = debug('webssh2:services:ssh')

/**
 * Connection pool for managing SSH connections
 */
class ConnectionPool {
  private readonly connections = new Map<ConnectionId, SSHConnection>()
  private readonly sessionConnections = new Map<SessionId, Set<ConnectionId>>()

  add(connection: SSHConnection): void {
    this.connections.set(connection.id, connection)
    
    const sessionConnections = this.sessionConnections.get(connection.sessionId) ?? new Set()
    sessionConnections.add(connection.id)
    this.sessionConnections.set(connection.sessionId, sessionConnections)
  }

  get(id: ConnectionId): SSHConnection | undefined {
    return this.connections.get(id)
  }

  remove(id: ConnectionId): void {
    const connection = this.connections.get(id)
    if (connection !== undefined) {
      const sessionConnections = this.sessionConnections.get(connection.sessionId)
      if (sessionConnections !== undefined) {
        sessionConnections.delete(id)
        if (sessionConnections.size === 0) {
          this.sessionConnections.delete(connection.sessionId)
        }
      }
      this.connections.delete(id)
    }
  }

  getBySession(sessionId: SessionId): SSHConnection[] {
    const connectionIds = this.sessionConnections.get(sessionId)
    if (connectionIds === undefined) {return []}
    
    const connections: SSHConnection[] = []
    for (const id of connectionIds) {
      const conn = this.connections.get(id)
      if (conn !== undefined) {connections.push(conn)}
    }
    return connections
  }

  clear(): void {
    for (const connection of this.connections.values()) {
      try {
        connection.client.end()
      } catch (error) {
        logger('Error closing connection:', error)
      }
    }
    this.connections.clear()
    this.sessionConnections.clear()
  }
}

export class SSHServiceImpl implements SSHService {
  private readonly pool = new ConnectionPool()
  private readonly connectionTimeout: number
  private readonly keepaliveInterval: number

  constructor(
    private readonly deps: ServiceDependencies,
    private readonly store: SessionStore
  ) {
    this.connectionTimeout = deps.config.ssh.readyTimeout
    this.keepaliveInterval = deps.config.ssh.keepaliveInterval
  }

  /**
   * Build SSH2 connection configuration
   */
  private buildConnectConfig(config: SSHConfig): Parameters<SSH2Client['connect']>[0] {
    const connectConfig: Parameters<SSH2Client['connect']>[0] = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: config.readyTimeout ?? this.connectionTimeout,
      keepaliveInterval: config.keepaliveInterval ?? this.keepaliveInterval,
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

  /**
   * Setup keyboard-interactive authentication handler
   */
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
   * Setup SSH connection event handlers
   */
  private setupConnectionHandlers(
    client: SSH2Client,
    connection: SSHConnection,
    config: SSHConfig,
    timeout: ReturnType<typeof setTimeout>,
    onReady: () => void,
    onError: (error: Error) => void
  ): void {
    // Handle ready event
    client.on('ready', () => {
      clearTimeout(timeout)
      logger('SSH connection ready')

      connection.status = 'connected'
      connection.lastActivity = Date.now()
      this.pool.add(connection)

      // Update store state
      this.store.dispatch(config.sessionId, {
        type: 'CONNECTION_ESTABLISHED',
        payload: { connectionId: connection.id }
      })

      onReady()
    })

    // Handle error event
    client.on('error', (error: Error & { level?: string }) => {
      clearTimeout(timeout)
      logger('SSH connection error:', error.message)
      logger('SSH error details:', {
        message: error.message,
        level: error.level,
        stack: error.stack
      })

      connection.status = 'error'

      // Update store state
      this.store.dispatch(config.sessionId, {
        type: 'CONNECTION_ERROR',
        payload: { error: error.message }
      })

      onError(error)
    })

    // Handle close event
    client.on('close', () => {
      logger('SSH connection closed')
      this.pool.remove(connection.id)

      // Update store state
      this.store.dispatch(config.sessionId, {
        type: 'CONNECTION_CLOSED',
        payload: {}
      })
    })
  }

  /**
   * Connect to SSH server
   */
  async connect(config: SSHConfig): Promise<Result<SSHConnection>> {
    // Validate connection against allowed subnets if configured
    const allowedSubnets = this.deps.config.ssh.allowedSubnets

    if (allowedSubnets != null && allowedSubnets.length > 0) {
      logger(`Validating connection to ${config.host} against subnet restrictions`)

      const validationResult = await validateConnectionWithDns(config.host, allowedSubnets)

      if (!validationResult.ok) {
        // DNS resolution failed
        logger(`Host validation failed: ${validationResult.error.message}`)
        return err(validationResult.error)
      }

      if (!validationResult.value) {
        // Host not in allowed subnets
        logger(`Host ${config.host} is not in allowed subnets: ${allowedSubnets.join(', ')}`)
        const errorMessage = `Connection to host ${config.host} is not permitted`
        return err(new Error(errorMessage))
      }

      logger(`Host ${config.host} passed subnet validation`)
    }

    return new Promise((resolve) => {
      try {
        logger('Connecting to SSH server:', config.host, config.port)

        const client = new SSH2Client()
        const connectionId = createConnectionId(randomUUID())

        // Create connection object
        const connection: SSHConnection = {
          id: connectionId,
          sessionId: config.sessionId,
          client,
          status: 'connecting',
          createdAt: Date.now(),
          lastActivity: Date.now()
        }

        // Setup timeout
        const timeout = setTimeout(() => {
          client.end()
          resolve(err(new Error('Connection timeout')))
        }, this.connectionTimeout)

        // Setup keyboard-interactive authentication
        this.setupKeyboardInteractiveHandler(client, config)

        // Setup connection event handlers
        this.setupConnectionHandlers(
          client,
          connection,
          config,
          timeout,
          () => resolve(ok(connection)),
          (error) => resolve(err(error))
        )

        // Build and apply connection config
        const connectConfig = this.buildConnectConfig(config)

        // Log the connection config (without sensitive data)
        logger('SSH2 client connect config:', {
          host: connectConfig.host,
          port: connectConfig.port,
          username: connectConfig.username,
          hasPassword: 'password' in connectConfig,
          hasPrivateKey: 'privateKey' in connectConfig,
          hasPassphrase: 'passphrase' in connectConfig,
          algorithms: connectConfig.algorithms !== undefined ? 'configured' : 'default',
          readyTimeout: connectConfig.readyTimeout,
          keepaliveInterval: connectConfig.keepaliveInterval,
          tryKeyboard: connectConfig.tryKeyboard
        })

        client.connect(connectConfig)

      } catch (error) {
        logger('Failed to connect:', error)
        resolve(err(error instanceof Error ? error : new Error('Connection failed')))
      }
    })
  }

  /**
   * Open a shell
   */
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
        const envOptions = options.env !== undefined ? { env: options.env } : {}

        logger('Shell environment options:', {
          hasEnv: options.env !== undefined,
          envKeys: options.env !== undefined ? Object.keys(options.env) : [],
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
            const streamWithWindow = stream as ClientChannel & { rows: number; cols: number }
            logger('Stream window size:', { rows: streamWithWindow.rows, cols: streamWithWindow.cols })
          }

          resolve(ok(stream))
        })

      } catch (error) {
        logger('Failed to open shell:', error)
        resolve(err(error instanceof Error ? error : new Error('Shell failed')))
      }
    })
  }

  /**
   * Execute a command
   */
  async exec(connectionId: ConnectionId, command: string): Promise<Result<ExecResult>> {
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

        logger('Executing command:', command)

        let stdout = ''
        let stderr = ''

        connection.client.exec(command, (error: Error | undefined, stream: ClientChannel) => {
          if (error !== undefined) {
            logger('Failed to execute command:', error)
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
            resolve(ok({ stdout, stderr, code }))
          })
        })

      } catch (error) {
        logger('Failed to execute command:', error)
        resolve(err(error instanceof Error ? error : new Error('Exec failed')))
      }
    })
  }

  /**
   * Disconnect
   */
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

  /**
   * Get connection status
   */
  getConnectionStatus(connectionId: ConnectionId): Result<SSHConnection | null> {
    const connection = this.pool.get(connectionId)
    return ok(connection ?? null)
  }

  /**
   * Disconnect all connections for a session
   */
  async disconnectSession(sessionId: SessionId): Promise<void> {
    const connections = this.pool.getBySession(sessionId)
    for (const connection of connections) {
      await this.disconnect(connection.id)
    }
  }


  /**
   * Clean up all connections
   */
  cleanup(): void {
    logger('Cleaning up all connections')
    this.pool.clear()
  }
}