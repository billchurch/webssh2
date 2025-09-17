/**
 * State type definitions for immutable state management
 */

import type { SessionId, UserId, ConnectionId } from '../types/branded.js'

/**
 * Root session state - immutable
 */
export interface SessionState {
  readonly id: SessionId
  readonly auth: AuthState
  readonly connection: ConnectionState
  readonly terminal: TerminalState
  readonly metadata: SessionMetadata
}

/**
 * Authentication state
 */
export interface AuthState {
  readonly status: 'pending' | 'authenticated' | 'failed'
  readonly method: 'basic' | 'manual' | 'post' | 'keyboard-interactive' | null
  readonly username: string | null
  readonly timestamp: number
  readonly errorMessage: string | null
}

/**
 * SSH connection state
 */
export interface ConnectionState {
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'closed'
  readonly connectionId: ConnectionId | null
  readonly host: string | null
  readonly port: number | null
  readonly errorMessage: string | null
  readonly lastActivity: number
}

/**
 * Terminal state
 */
export interface TerminalState {
  readonly term: string
  readonly rows: number
  readonly cols: number
  readonly environment: Readonly<Record<string, string>>
  readonly cwd: string | null
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  readonly createdAt: number
  readonly updatedAt: number
  readonly clientIp: string | null
  readonly userAgent: string | null
  readonly userId: UserId | null
}

/**
 * Connection pool entry
 */
export interface PooledConnection {
  readonly id: ConnectionId
  readonly sessionId: SessionId
  readonly status: ConnectionStatus
  readonly createdAt: number
  readonly lastActivity: number
  readonly metrics: ConnectionMetrics
}

/**
 * Connection status
 */
export type ConnectionStatus = 
  | 'idle'
  | 'active'
  | 'closing'
  | 'closed'
  | 'error'

/**
 * Connection metrics
 */
export interface ConnectionMetrics {
  readonly bytesReceived: number
  readonly bytesSent: number
  readonly packetsReceived: number
  readonly packetsSent: number
  readonly latency: number | null
}

/**
 * State listener callback type
 */
export type StateListener = (
  newState: SessionState,
  oldState: SessionState
) => void

/**
 * Result type for error handling
 */
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E }

/**
 * Helper functions for Result type
 */
export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const err = <E = Error>(error: E): Result<never, E> => ({ ok: false, error })

/**
 * Initial state factory
 */
export const createInitialState = (sessionId: SessionId): SessionState => ({
  id: sessionId,
  auth: {
    status: 'pending',
    method: null,
    username: null,
    timestamp: Date.now(),
    errorMessage: null
  },
  connection: {
    status: 'disconnected',
    connectionId: null,
    host: null,
    port: null,
    errorMessage: null,
    lastActivity: Date.now()
  },
  terminal: {
    term: 'xterm-256color',
    rows: 24,
    cols: 80,
    environment: {},
    cwd: null
  },
  metadata: {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    clientIp: null,
    userAgent: null,
    userId: null
  }
})