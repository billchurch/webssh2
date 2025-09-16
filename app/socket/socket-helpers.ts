// app/socket/socket-helpers.ts
// Pure helper functions for socket operations

import type { Config } from '../types/config.js'

/**
 * Session state interface
 */
export interface SessionState {
  authenticated: boolean
  username: string | null
  password: string | null
  privateKey: string | null
  passphrase: string | null
  host: string | null
  port: number | null
  term: string | null
  cols: number | null
  rows: number | null
}

/**
 * Creates initial session state
 * Pure function - no side effects
 */
export function createInitialSessionState(): SessionState {
  return {
    authenticated: false,
    username: null,
    password: null,
    privateKey: null,
    passphrase: null,
    host: null,
    port: null,
    term: null,
    cols: null,
    rows: null,
  }
}

/**
 * Extract terminal configuration from credentials
 * Pure function - no side effects
 */
export function extractTerminalConfig(creds: Record<string, unknown>): {
  term: string | null
  cols: number | null
  rows: number | null
} {
  return {
    term: typeof creds['term'] === 'string' ? creds['term'] : null,
    cols: typeof creds['cols'] === 'number' ? creds['cols'] : null,
    rows: typeof creds['rows'] === 'number' ? creds['rows'] : null,
  }
}

/**
 * Merge session state with new credentials
 * Pure function - returns new state without mutation
 */
export function mergeSessionState(
  currentState: SessionState,
  updates: Partial<SessionState>
): SessionState {
  return { ...currentState, ...updates }
}

/**
 * Validate terminal dimensions
 * Pure function - no side effects
 */
export function isValidDimension(value: unknown): boolean {
  return typeof value === 'number' && value > 0 && value < 1000
}

/**
 * Get default terminal configuration
 * Pure function - no side effects
 */
export function getDefaultTerminalConfig(config: Config): {
  term: string
  cols: number
  rows: number
} {
  return {
    term: config.ssh.term,
    cols: 80, // Default terminal columns
    rows: 24, // Default terminal rows
  }
}

/**
 * Check if session has valid SSH credentials
 * Pure function - no side effects
 */
export function hasValidSshCredentials(state: SessionState): boolean {
  return (
    state.host != null &&
    state.host !== '' &&
    state.username != null &&
    state.username !== '' &&
    ((state.password != null && state.password !== '' && state.password.length > 0) || 
     (state.privateKey != null && state.privateKey !== '' && state.privateKey.length > 0))
  )
}

/**
 * Create error payload for socket emission
 * Pure function - no side effects
 */
export function createErrorPayload(message: string, code?: string): {
  message: string
  code?: string
  timestamp: number
} {
  return {
    message,
    ...(code && { code }),
    timestamp: Date.now(),
  }
}