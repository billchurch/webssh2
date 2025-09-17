/**
 * Connection pool for SSH connection management
 */

import type { SessionId, ConnectionId } from '../types/branded.js'
import type { PooledConnection, ConnectionStatus, Result } from '../state/types.js'
import { createConnectionId } from '../types/branded.js'
import { ok, err } from '../state/types.js'
import debug from 'debug'
import type { Client } from 'ssh2'

const logger = debug('webssh2:pool')

/**
 * Connection factory interface
 */
export interface ConnectionFactory {
  create(sessionId: SessionId, params: ConnectionParams): Promise<Result<Client>>
  destroy(client: Client): Promise<void>
}

/**
 * Connection parameters
 */
export interface ConnectionParams {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: Buffer
  passphrase?: string
}

/**
 * Pool configuration
 */
export interface PoolConfig {
  maxConnections: number
  idleTimeout: number
  connectionTimeout: number
  cleanupInterval: number
}

/**
 * Extended connection information
 */
interface PoolEntry {
  id: ConnectionId
  sessionId: SessionId
  status: ConnectionStatus
  createdAt: number
  lastActivity: number
  metrics: {
    bytesReceived: number
    bytesSent: number
    packetsReceived: number
    packetsSent: number
    latency: number | null
  }
  client: Client | null
  params: ConnectionParams | null
  timeoutHandle?: NodeJS.Timeout
}

/**
 * Connection pool with lifecycle management
 */
export class ConnectionPool {
  private readonly connections = new Map<ConnectionId, PoolEntry>()
  private readonly sessionToConnection = new Map<SessionId, ConnectionId>()
  private cleanupTimer?: NodeJS.Timer
  private readonly config: PoolConfig

  constructor(
    private readonly factory: ConnectionFactory,
    config: Partial<PoolConfig> = {}
  ) {
    this.config = {
      maxConnections: config.maxConnections ?? 100,
      idleTimeout: config.idleTimeout ?? 300000, // 5 minutes
      connectionTimeout: config.connectionTimeout ?? 30000, // 30 seconds
      cleanupInterval: config.cleanupInterval ?? 60000 // 1 minute
    }

    // Start cleanup timer
    this.startCleanupTimer()
  }

  /**
   * Acquire a connection for a session
   */
  async acquire(
    sessionId: SessionId,
    params: ConnectionParams
  ): Promise<Result<ConnectionId>> {
    logger('Acquiring connection for session:', sessionId)

    // Check if session already has a connection
    const existingId = this.sessionToConnection.get(sessionId)
    if (existingId) {
      const existing = this.connections.get(existingId)
      if (existing && existing.status === 'active') {
        this.updateActivity(existingId)
        logger('Reusing existing connection:', existingId)
        return ok(existingId)
      } else {
        // Clean up stale connection
        await this.release(existingId)
      }
    }

    // Check pool capacity
    if (this.connections.size >= this.config.maxConnections) {
      await this.cleanupIdle()
      if (this.connections.size >= this.config.maxConnections) {
        logger('Connection pool exhausted')
        return err(new Error('Connection pool exhausted'))
      }
    }

    // Create new connection
    const connectionId = createConnectionId(`conn_${Date.now()}_${Math.random().toString(36).slice(2)}`)
    const entry: PoolEntry = {
      id: connectionId,
      sessionId,
      status: 'idle',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metrics: {
        bytesReceived: 0,
        bytesSent: 0,
        packetsReceived: 0,
        packetsSent: 0,
        latency: null
      },
      client: null,
      params
    }

    this.connections.set(connectionId, entry)
    this.sessionToConnection.set(sessionId, connectionId)

    // Attempt to establish connection
    try {
      const result = await this.factory.create(sessionId, params)
      if (!result.ok) {
        this.connections.delete(connectionId)
        this.sessionToConnection.delete(sessionId)
        return err(result.error)
      }

      entry.client = result.value
      entry.status = 'active'
      this.setupIdleTimeout(connectionId)
      
      logger('Connection established:', connectionId)
      return ok(connectionId)
    } catch (error) {
      this.connections.delete(connectionId)
      this.sessionToConnection.delete(sessionId)
      logger('Failed to create connection:', error)
      return err(error as Error)
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: ConnectionId): Client | null {
    const entry = this.connections.get(connectionId)
    return entry?.client ?? null
  }

  /**
   * Get connection info
   */
  getConnectionInfo(connectionId: ConnectionId): PooledConnection | null {
    const entry = this.connections.get(connectionId)
    if (!entry) {return null}

    // Return public info only
    const { client, params, timeoutHandle, ...info } = entry
    return info
  }

  /**
   * Release a connection
   */
  async release(connectionId: ConnectionId): Promise<Result<void>> {
    const entry = this.connections.get(connectionId)
    if (entry === undefined) {
      return err(new Error('Connection not found'))
    }

    logger('Releasing connection:', connectionId)

    // Clear timeout
    if (entry.timeoutHandle) {
      clearTimeout(entry.timeoutHandle)
    }

    // Destroy client connection
    if (entry.client) {
      try {
        await this.factory.destroy(entry.client)
      } catch (error) {
        logger('Error destroying connection:', error)
      }
    }

    // Clean up mappings
    this.connections.delete(connectionId)
    this.sessionToConnection.delete(entry.sessionId)

    return ok(undefined)
  }

  /**
   * Release all connections for a session
   */
  async releaseSession(sessionId: SessionId): Promise<void> {
    const connectionId = this.sessionToConnection.get(sessionId)
    if (connectionId) {
      await this.release(connectionId)
    }
  }

  /**
   * Update connection activity timestamp
   */
  updateActivity(connectionId: ConnectionId): void {
    const entry = this.connections.get(connectionId)
    if (entry) {
      entry.lastActivity = Date.now()
      this.resetIdleTimeout(connectionId)
    }
  }

  /**
   * Update connection metrics
   */
  updateMetrics(
    connectionId: ConnectionId,
    metrics: Partial<PoolEntry['metrics']>
  ): void {
    const entry = this.connections.get(connectionId)
    if (entry) {
      entry.metrics = { ...entry.metrics, ...metrics }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalConnections: number
    activeConnections: number
    idleConnections: number
    avgLatency: number | null
  } {
    let activeCount = 0
    let idleCount = 0
    let totalLatency = 0
    let latencyCount = 0

    for (const entry of this.connections.values()) {
      if (entry.status === 'active') {activeCount++}
      if (entry.status === 'idle') {idleCount++}
      if (entry.metrics.latency !== null) {
        totalLatency += entry.metrics.latency
        latencyCount++
      }
    }

    return {
      totalConnections: this.connections.size,
      activeConnections: activeCount,
      idleConnections: idleCount,
      avgLatency: latencyCount > 0 ? totalLatency / latencyCount : null
    }
  }

  /**
   * Shutdown pool and release all connections
   */
  async shutdown(): Promise<void> {
    logger('Shutting down connection pool')

    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    // Release all connections
    const releases = Array.from(this.connections.keys()).map(id =>
      this.release(id).catch(error =>
        logger('Error releasing connection during shutdown:', error)
      )
    )

    await Promise.all(releases)
    
    this.connections.clear()
    this.sessionToConnection.clear()
    
    logger('Connection pool shutdown complete')
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdle(): Promise<void> {
    const now = Date.now()
    const toRelease: ConnectionId[] = []

    for (const [id, entry] of this.connections) {
      if (entry.status === 'idle' && 
          now - entry.lastActivity > this.config.idleTimeout) {
        toRelease.push(id)
      }
    }

    logger('Cleaning up', toRelease.length, 'idle connections')

    for (const id of toRelease) {
      await this.release(id).catch(error =>
        logger('Error releasing idle connection:', error)
      )
    }
  }

  /**
   * Setup idle timeout for connection
   */
  private setupIdleTimeout(connectionId: ConnectionId): void {
    const entry = this.connections.get(connectionId)
    if (!entry) {return}

    entry.timeoutHandle = setTimeout(() => {
      logger('Connection idle timeout:', connectionId)
      entry.status = 'idle'
    }, this.config.idleTimeout)
  }

  /**
   * Reset idle timeout
   */
  private resetIdleTimeout(connectionId: ConnectionId): void {
    const entry = this.connections.get(connectionId)
    if (!entry) {return}

    if (entry.timeoutHandle) {
      clearTimeout(entry.timeoutHandle)
    }
    
    if (entry.status === 'active') {
      this.setupIdleTimeout(connectionId)
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdle().catch(error =>
        logger('Error during periodic cleanup:', error)
      )
    }, this.config.cleanupInterval)
  }
}

// Singleton instance
let poolInstance: ConnectionPool | null = null

/**
 * Get singleton pool instance
 */
export const getPool = (factory?: ConnectionFactory): ConnectionPool => {
  if (!poolInstance) {
    if (!factory) {
      throw new Error('ConnectionFactory required for first pool initialization')
    }
    poolInstance = new ConnectionPool(factory)
  }
  return poolInstance
}

/**
 * Reset pool (for testing)
 */
export const resetPool = async (): Promise<void> => {
  if (poolInstance) {
    await poolInstance.shutdown()
    poolInstance = null
  }
}