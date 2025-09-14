// app/socket/credential-manager.ts
// Credential management for WebSocket connections

import validator from 'validator'
import { createNamespacedDebug } from '../logger.js'
import { validateSshTerm } from '../utils.js'
import { hasCompleteSessionCredentials, extractSessionCredentials } from '../validation/session.js'
import type { Credentials } from '../validation/credentials.js'
import type { Config } from '../types/config.js'
import type { Socket } from 'socket.io'

const debug = createNamespacedDebug('socket:credential')

export interface CredentialUpdate {
  success: boolean
  error?: string
}

export interface TerminalConfig {
  term: string | null
  cols: number | null
  rows: number | null
}

interface ExtendedRequest {
  session?: {
    sshCredentials?: Credentials
    authMethod?: string
    [key: string]: unknown
  }
}

/**
 * Validates credential format
 * @param creds - Credentials to validate
 * @returns true if credentials have valid format
 * @pure
 */
export function isValidCredentialFormat(creds: Record<string, unknown>): boolean {
  // Allow empty credentials object (for session-based auth)
  if (Object.keys(creds).length === 0) {
    return true
  }
  
  // Basic validation - must have host and username at minimum
  return Boolean(
    creds['host'] != null &&
    typeof creds['host'] === 'string' &&
    creds['host'] !== '' &&
    creds['username'] != null &&
    typeof creds['username'] === 'string' &&
    creds['username'] !== ''
  )
}

/**
 * Validates dimension value
 * @param value - Value to validate
 * @returns true if value is a valid integer
 * @pure
 */
export function isValidDimension(value: unknown): boolean {
  return validator.isInt(String(value))
}

/**
 * Parses dimension value safely
 * @param value - Value to parse
 * @returns Parsed integer or null if invalid
 * @pure
 */
export function parseDimension(value: unknown): number | null {
  if (!isValidDimension(value)) {
    return null
  }
  return parseInt(String(value), 10)
}

/**
 * Configures terminal settings from credentials
 * @param validCreds - Validated credentials
 * @param manualCreds - Manual credential input
 * @param config - Application configuration
 * @returns Terminal configuration
 * @pure
 */
export function configureTerminal(
  validCreds: Credentials,
  manualCreds: Record<string, unknown>,
  config: Config
): TerminalConfig {
  // Validate and set terminal type
  const validatedTerm = validateSshTerm(validCreds.term)
  const term = validatedTerm ?? config.ssh.term
  
  debug(
    `Terminal config: creds.term='${validCreds.term}', validatedTerm='${validatedTerm}', final='${term}'`
  )
  
  // Parse dimensions from manual auth
  const cols = 'cols' in manualCreds ? parseDimension(manualCreds['cols']) : null
  const rows = 'rows' in manualCreds ? parseDimension(manualCreds['rows']) : null
  
  return { term, cols, rows }
}

/**
 * Creates error message for credential validation failure
 * @param reason - Reason for failure
 * @returns User-friendly error message
 * @pure
 */
export function createCredentialErrorMessage(reason: string): string {
  return `Invalid credentials: ${reason}`
}

/**
 * Updates session credentials if conditions are met
 * @param socket - Socket.IO socket instance
 * @param credentials - New credentials
 * @returns Update result
 */
export function updateSessionCredentials(
  socket: Socket,
  credentials: Record<string, unknown>
): CredentialUpdate {
  const req = socket.request as ExtendedRequest
  
  if (req.session == null) {
    return { success: true } // No session to update
  }
  
  if (!hasCompleteSessionCredentials(credentials)) {
    return { success: true } // Incomplete credentials, skip update
  }
  
  const sessionCreds = extractSessionCredentials(credentials)
  if (sessionCreds == null) {
    return {
      success: false,
      error: 'Failed to extract session credentials'
    }
  }
  
  debug('Updating session credentials with new user input')
  req.session.sshCredentials = sessionCreds
  
  return { success: true }
}

/**
 * Logs credential update for debugging
 * @param originalAuthMethod - Original authentication method
 * @param newAuthMethod - New authentication method
 */
export function logCredentialUpdate(
  originalAuthMethod: string | null,
  newAuthMethod: string
): void {
  debug(
    `Updated credentials from user input (was ${originalAuthMethod}, now ${newAuthMethod})`
  )
}

/**
 * Validates and updates credentials
 * @param socket - Socket.IO socket instance
 * @param credentials - Credentials to validate and update
 * @param originalAuthMethod - Original authentication method
 * @returns Update result
 */
export function validateAndUpdateCredentials(
  socket: Socket,
  credentials: Record<string, unknown>,
  originalAuthMethod: string | null
): CredentialUpdate {
  // Validate credential format
  if (!isValidCredentialFormat(credentials)) {
    return {
      success: false,
      error: createCredentialErrorMessage('Invalid format')
    }
  }
  
  // Update session credentials
  const updateResult = updateSessionCredentials(socket, credentials)
  if (!updateResult.success) {
    return updateResult
  }
  
  // Log the update
  logCredentialUpdate(originalAuthMethod, 'manual')
  
  return { success: true }
}

/**
 * Creates session state from credentials
 * @param credentials - Connection credentials
 * @returns Partial session state update
 * @pure
 */
export function createSessionStateFromCredentials(
  credentials: Record<string, unknown>
): {
  authenticated: boolean
  username: string | null
  password: string | null
  privateKey: string | null
  passphrase: string | null
  host: string | null
  port: number | null
} {
  return {
    authenticated: true,
    username: credentials['username'] as string | null,
    password: credentials['password'] as string | null,
    privateKey: credentials['privateKey'] as string | null,
    passphrase: credentials['passphrase'] as string | null,
    host: credentials['host'] as string | null,
    port: credentials['port'] as number | null,
  }
}