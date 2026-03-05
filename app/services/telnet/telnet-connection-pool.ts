/**
 * Connection pool for managing telnet connections
 */

import type { Socket } from 'node:net'
import type { ConnectionId, SessionId } from '../../types/branded.js'
import type { ProtocolConnection } from '../interfaces.js'
import type { TelnetNegotiator } from './telnet-negotiation.js'
import type { TelnetAuthenticator } from './telnet-auth.js'
import debug from 'debug'

const logger = debug('webssh2:services:telnet:pool')

/**
 * Telnet connection extending the protocol-agnostic connection with a raw socket
 */
export interface TelnetConnection extends ProtocolConnection {
  socket: Socket
  negotiator?: TelnetNegotiator
  authenticator?: TelnetAuthenticator
}

/**
 * Pool for managing telnet connections by session and connection ID
 */
export class TelnetConnectionPool {
  private readonly connections = new Map<ConnectionId, TelnetConnection>()
  private readonly sessionConnections = new Map<SessionId, Set<ConnectionId>>()

  /**
   * Add a connection to the pool
   * @param connection - Telnet connection to add
   */
  add(connection: TelnetConnection): void {
    this.connections.set(connection.id, connection)

    const sessionSet = this.sessionConnections.get(connection.sessionId) ?? new Set()
    sessionSet.add(connection.id)
    this.sessionConnections.set(connection.sessionId, sessionSet)

    logger('Added connection %s for session %s (pool size: %d)', connection.id, connection.sessionId, this.connections.size)
  }

  /**
   * Get a connection by ID
   * @param connectionId - Connection ID
   * @returns Telnet connection or undefined if not found
   */
  get(connectionId: ConnectionId): TelnetConnection | undefined {
    return this.connections.get(connectionId)
  }

  /**
   * Get all connections for a session
   * @param sessionId - Session ID
   * @returns Array of telnet connections for the session
   */
  getBySession(sessionId: SessionId): TelnetConnection[] {
    const connectionIds = this.sessionConnections.get(sessionId)
    if (connectionIds === undefined) {
      return []
    }

    const connections: TelnetConnection[] = []
    for (const id of connectionIds) {
      const conn = this.connections.get(id)
      if (conn !== undefined) {
        connections.push(conn)
      }
    }
    return connections
  }

  /**
   * Remove a connection from the pool
   * @param connectionId - Connection ID to remove
   * @returns true if the connection was found and removed, false otherwise
   */
  remove(connectionId: ConnectionId): boolean {
    const connection = this.connections.get(connectionId)
    if (connection === undefined) {
      return false
    }

    const sessionSet = this.sessionConnections.get(connection.sessionId)
    if (sessionSet !== undefined) {
      sessionSet.delete(connectionId)
      if (sessionSet.size === 0) {
        this.sessionConnections.delete(connection.sessionId)
      }
    }

    this.connections.delete(connectionId)
    logger('Removed connection %s (pool size: %d)', connectionId, this.connections.size)
    return true
  }

  /**
   * Clear all connections
   */
  clear(): void {
    for (const connection of this.connections.values()) {
      try {
        connection.authenticator?.destroy()
        connection.socket.destroy()
      } catch (error) {
        logger('Error destroying socket for connection %s: %O', connection.id, error)
      }
    }
    this.connections.clear()
    this.sessionConnections.clear()
    logger('Cleared all connections')
  }

  /**
   * Get the number of connections in the pool
   */
  get size(): number {
    return this.connections.size
  }
}
