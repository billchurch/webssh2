/**
 * Connection pool for managing SSH connections
 */

import type { SSHConnection } from '../interfaces.js'
import type { ConnectionId, SessionId } from '../../types/branded.js'
import debug from 'debug'

const logger = debug('webssh2:services:ssh:pool')

/**
 * Pool for managing SSH client connections by session and connection ID
 */
export class ConnectionPool {
  private readonly connections = new Map<ConnectionId, SSHConnection>()
  private readonly sessionConnections = new Map<SessionId, Set<ConnectionId>>()

  /**
   * Add a connection to the pool
   * @param connection - SSH connection to add
   */
  add(connection: SSHConnection): void {
    this.connections.set(connection.id, connection)

    const sessionConnections = this.sessionConnections.get(connection.sessionId) ?? new Set()
    sessionConnections.add(connection.id)
    this.sessionConnections.set(connection.sessionId, sessionConnections)
  }

  /**
   * Get a connection by ID
   * @param id - Connection ID
   * @returns SSH connection or undefined if not found
   */
  get(id: ConnectionId): SSHConnection | undefined {
    return this.connections.get(id)
  }

  /**
   * Remove a connection from the pool
   * @param id - Connection ID to remove
   */
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

  /**
   * Get all connections for a session
   * @param sessionId - Session ID
   * @returns Array of SSH connections for the session
   */
  getBySession(sessionId: SessionId): SSHConnection[] {
    const connectionIds = this.sessionConnections.get(sessionId)
    if (connectionIds === undefined) {
      return []
    }

    const connections: SSHConnection[] = []
    for (const id of connectionIds) {
      const conn = this.connections.get(id)
      if (conn !== undefined) {
        connections.push(conn)
      }
    }
    return connections
  }

  /**
   * Clear all connections and close clients
   */
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