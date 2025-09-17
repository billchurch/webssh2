/**
 * Redux-style action definitions for state management
 */

import type { ConnectionId, UserId } from '../types/branded.js'

/**
 * Authentication actions
 */
export type AuthAction =
  | { type: 'AUTH_REQUEST'; payload: { method: string; username?: string } }
  | { type: 'AUTH_SUCCESS'; payload: { username: string; method: string; userId?: UserId } }
  | { type: 'AUTH_FAILURE'; payload: { error: string; method: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_CLEAR_ERROR' }

/**
 * Connection actions
 */
export type ConnectionAction =
  | { type: 'CONNECTION_START'; payload: { host: string; port: number } }
  | { type: 'CONNECTION_ESTABLISHED'; payload: { connectionId: ConnectionId } }
  | { type: 'CONNECTION_ERROR'; payload: { error: string } }
  | { type: 'CONNECTION_CLOSED'; payload: { reason?: string } }
  | { type: 'CONNECTION_ACTIVITY' }

/**
 * Terminal actions
 */
export type TerminalAction =
  | { type: 'TERMINAL_RESIZE'; payload: { rows: number; cols: number } }
  | { type: 'TERMINAL_SET_TERM'; payload: { term: string } }
  | { type: 'TERMINAL_SET_ENV'; payload: { environment: Record<string, string> } }
  | { type: 'TERMINAL_SET_CWD'; payload: { cwd: string } }

/**
 * Metadata actions
 */
export type MetadataAction =
  | { type: 'METADATA_SET_CLIENT'; payload: { clientIp: string; userAgent: string } }
  | { type: 'METADATA_UPDATE_TIMESTAMP' }

/**
 * Combined action type
 */
export type SessionAction =
  | AuthAction
  | ConnectionAction
  | TerminalAction
  | MetadataAction
  | { type: 'SESSION_RESET' }
  | { type: 'SESSION_END' }

/**
 * Action creator helpers
 */
export const actions = {
  auth: {
    request: (method: string, username?: string): AuthAction => ({
      type: 'AUTH_REQUEST',
      payload: username !== undefined ? { method, username } : { method }
    }),
    success: (username: string, method: string, userId?: UserId): AuthAction => ({
      type: 'AUTH_SUCCESS',
      payload: userId !== undefined ? { username, method, userId } : { username, method }
    }),
    failure: (error: string, method: string): AuthAction => ({
      type: 'AUTH_FAILURE',
      payload: { error, method }
    }),
    logout: (): AuthAction => ({ type: 'AUTH_LOGOUT' }),
    clearError: (): AuthAction => ({ type: 'AUTH_CLEAR_ERROR' })
  },

  connection: {
    start: (host: string, port: number): ConnectionAction => ({
      type: 'CONNECTION_START',
      payload: { host, port }
    }),
    established: (connectionId: ConnectionId): ConnectionAction => ({
      type: 'CONNECTION_ESTABLISHED',
      payload: { connectionId }
    }),
    error: (error: string): ConnectionAction => ({
      type: 'CONNECTION_ERROR',
      payload: { error }
    }),
    closed: (reason?: string): ConnectionAction => ({
      type: 'CONNECTION_CLOSED',
      payload: reason !== undefined ? { reason } : {}
    }),
    activity: (): ConnectionAction => ({ type: 'CONNECTION_ACTIVITY' })
  },

  terminal: {
    resize: (rows: number, cols: number): TerminalAction => ({
      type: 'TERMINAL_RESIZE',
      payload: { rows, cols }
    }),
    setTerm: (term: string): TerminalAction => ({
      type: 'TERMINAL_SET_TERM',
      payload: { term }
    }),
    setEnv: (environment: Record<string, string>): TerminalAction => ({
      type: 'TERMINAL_SET_ENV',
      payload: { environment }
    }),
    setCwd: (cwd: string): TerminalAction => ({
      type: 'TERMINAL_SET_CWD',
      payload: { cwd }
    })
  },

  metadata: {
    setClient: (clientIp: string, userAgent: string): MetadataAction => ({
      type: 'METADATA_SET_CLIENT',
      payload: { clientIp, userAgent }
    }),
    updateTimestamp: (): MetadataAction => ({ type: 'METADATA_UPDATE_TIMESTAMP' })
  },

  session: {
    reset: (): SessionAction => ({ type: 'SESSION_RESET' }),
    end: (): SessionAction => ({ type: 'SESSION_END' })
  }
}