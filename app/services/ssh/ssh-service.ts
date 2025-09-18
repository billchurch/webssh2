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
   * Connect to SSH server
   */
  async connect(config: SSHConfig): Promise<Result<SSHConnection>> {
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
            payload: { connectionId }
          })

          resolve(ok(connection))
        })

        // Handle error event
        client.on('error', (error: Error) => {
          clearTimeout(timeout)
          logger('SSH connection error:', error)
          
          connection.status = 'error'
          
          // Update store state
          this.store.dispatch(config.sessionId, {
            type: 'CONNECTION_ERROR',
            payload: { error: error.message }
          })

          resolve(err(error))
        })

        // Handle close event
        client.on('close', () => {
          logger('SSH connection closed')
          this.pool.remove(connectionId)
          
          // Update store state
          this.store.dispatch(config.sessionId, {
            type: 'CONNECTION_CLOSED',
            payload: {}
          })
        })

        // Connect
        const connectConfig: Parameters<SSH2Client['connect']>[0] = {
          host: config.host,
          port: config.port,
          username: config.username,
          readyTimeout: config.readyTimeout ?? this.connectionTimeout,
          keepaliveInterval: config.keepaliveInterval ?? this.keepaliveInterval
        }

        if (config.password !== undefined && config.password !== '') {
          connectConfig.password = config.password
        } else if (config.privateKey !== undefined && config.privateKey !== '') {
          connectConfig.privateKey = config.privateKey
          if (config.passphrase !== undefined && config.passphrase !== '') {
            connectConfig.passphrase = config.passphrase
          }
        }

        if (config.algorithms !== undefined) {
          connectConfig.algorithms = config.algorithms
        }

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
        
        const shellOptions: PseudoTtyOptions & { env?: Record<string, string> } = {
          term: options.term ?? 'xterm-256color',
          cols: options.cols ?? 80,
          rows: options.rows ?? 24
        }

        if (options.env !== undefined) {
          shellOptions.env = options.env
        }

        connection.client.shell(shellOptions, (error: Error | undefined, stream: ClientChannel) => {
          if (error !== undefined) {
            logger('Failed to open shell:', error)
            resolve(err(error))
            return
          }

          connection.lastActivity = Date.now()
          logger('Shell opened successfully')
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