/**
 * State selectors for deriving data from session state
 * All selectors are pure functions with no side effects
 */

import type { SessionState, AuthState, ConnectionState } from './types.js'
import type { ConnectionId, SessionId, UserId } from '../types/branded.js'

/**
 * Authentication selectors
 */
export const isAuthenticated = (state: SessionState): boolean =>
  state.auth.status === 'authenticated'

export const isAuthPending = (state: SessionState): boolean =>
  state.auth.status === 'pending'

export const hasAuthError = (state: SessionState): boolean =>
  state.auth.status === 'failed'

export const getAuthError = (state: SessionState): string | null =>
  state.auth.errorMessage

export const getAuthMethod = (state: SessionState): AuthState['method'] =>
  state.auth.method

export const getUsername = (state: SessionState): string | null =>
  state.auth.username

/**
 * Connection selectors
 */
export const isConnected = (state: SessionState): boolean =>
  state.connection.status === 'connected'

export const isConnecting = (state: SessionState): boolean =>
  state.connection.status === 'connecting'

export const hasConnectionError = (state: SessionState): boolean =>
  state.connection.status === 'error'

export const getConnectionError = (state: SessionState): string | null =>
  state.connection.errorMessage

export const getConnectionInfo = (state: SessionState): {
  host: string | null
  port: number | null
  status: ConnectionState['status']
  connectionId: ConnectionId | null
} => ({
  host: state.connection.host,
  port: state.connection.port,
  status: state.connection.status,
  connectionId: state.connection.connectionId
})

export const getConnectionStatus = (state: SessionState): ConnectionState['status'] =>
  state.connection.status

/**
 * Terminal selectors
 */
export const getTerminalDimensions = (state: SessionState): { rows: number; cols: number } => ({
  rows: state.terminal.rows,
  cols: state.terminal.cols
})

export const getTerminalType = (state: SessionState): string =>
  state.terminal.term

export const getTerminalEnvironment = (state: SessionState): Readonly<Record<string, string>> =>
  state.terminal.environment

export const getWorkingDirectory = (state: SessionState): string | null =>
  state.terminal.cwd

/**
 * Combined selectors
 */
export const canExecuteCommands = (state: SessionState): boolean =>
  isAuthenticated(state) && isConnected(state)

export const canResize = (state: SessionState): boolean =>
  isConnected(state)

export const isSessionActive = (state: SessionState): boolean =>
  isAuthenticated(state) && (isConnected(state) || isConnecting(state))

export const getSessionSummary = (state: SessionState): {
  id: SessionId
  authenticated: boolean
  connected: boolean
  username: string | null
  host: string | null
  port: number | null
  terminal: string
  dimensions: { rows: number; cols: number }
} => ({
  id: state.id,
  authenticated: isAuthenticated(state),
  connected: isConnected(state),
  username: getUsername(state),
  host: state.connection.host,
  port: state.connection.port,
  terminal: getTerminalType(state),
  dimensions: getTerminalDimensions(state)
})

/**
 * Metadata selectors
 */
export const getSessionAge = (state: SessionState): number =>
  Date.now() - state.metadata.createdAt

export const getLastActivity = (state: SessionState): number =>
  Math.max(state.metadata.updatedAt, state.connection.lastActivity)

export const getIdleTime = (state: SessionState): number =>
  Date.now() - getLastActivity(state)

export const isIdle = (state: SessionState, threshold = 300000): boolean =>
  getIdleTime(state) > threshold

export const getClientInfo = (state: SessionState): {
  ip: string | null
  userAgent: string | null
  userId: UserId | null
} => ({
  ip: state.metadata.clientIp,
  userAgent: state.metadata.userAgent,
  userId: state.metadata.userId
})

/**
 * Error selectors
 */
export const getAllErrors = (state: SessionState): string[] => {
  const errors: string[] = []
  
  if (state.auth.errorMessage !== null) {
    errors.push(`Auth: ${state.auth.errorMessage}`)
  }
  
  if (state.connection.errorMessage !== null) {
    errors.push(`Connection: ${state.connection.errorMessage}`)
  }
  
  return errors
}

export const hasAnyError = (state: SessionState): boolean =>
  hasAuthError(state) || hasConnectionError(state)

/**
 * Status selectors
 */
export const getOverallStatus = (state: SessionState): 
  'initializing' | 'authenticating' | 'connecting' | 'ready' | 'error' | 'closed' => {
  
  if (state.connection.status === 'closed') {return 'closed'}
  if (hasAnyError(state)) {return 'error'}
  
  if (!isAuthenticated(state)) {return 'authenticating'}
  if (!isConnected(state)) {return 'connecting'}
  
  return 'ready'
}

/**
 * Feature flag selectors (for gradual rollout)
 */
export const shouldUseNewAuth = (_state: SessionState): boolean => {
  // Can be controlled per session or globally
  return true // Enable for all sessions for now
}

export const shouldUseConnectionPool = (_state: SessionState): boolean => {
  // Can be controlled per session or globally
  return true // Enable for all sessions for now
}