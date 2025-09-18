// app/socket/connection-handler.ts
// Connection management handler for WebSocket connections

import { createNamespacedDebug } from '../logger.js'
import { SSHConnectionError } from '../errors.js'
import { isNetworkError, extractSessionCredentials, hasCompleteSessionCredentials } from '../validation/session.js'
import type { Credentials } from '../validation/credentials.js'
import type { Config } from '../types/config.js'
import type { Socket } from 'socket.io'
import { VALIDATION_MESSAGES, DEFAULTS } from '../constants/index.js'

const debug = createNamespacedDebug('socket:connection')

export interface ConnectionCredentials extends Credentials {
  privateKey?: string
}

export interface AuthenticationPayload {
  action: 'auth_result'
  success: boolean
  message?: string
}

export interface PermissionsPayload {
  autoLog: boolean
  allowReplay: boolean
  allowReconnect: boolean
  allowReauth: boolean
}

export interface UIUpdatePayload {
  element: string
  value: string
}

interface ExtendedRequest {
  session?: {
    usedBasicAuth?: boolean
    sshCredentials?: Credentials
    envVars?: Record<string, string>
    authMethod?: string
    authFailed?: boolean
    [key: string]: unknown
  }
}

/**
 * Prepares credentials for SSH connection by merging with server defaults
 * @param creds - User provided credentials
 * @param config - Application configuration
 * @returns Prepared credentials with server private key if needed
 * @pure
 */
export function prepareCredentials(
  creds: Credentials,
  config: Config
): ConnectionCredentials {
  const prepared = { ...creds } as ConnectionCredentials

  // Use server private key if none provided
  if (config.user.privateKey != null && 
      config.user.privateKey !== '' && 
      (prepared.privateKey == null || prepared.privateKey === '')) {
    prepared.privateKey = config.user.privateKey
  }

  return prepared
}

/**
 * Creates authentication success payload
 * @returns Success authentication payload
 * @pure
 */
export function createAuthSuccessPayload(): AuthenticationPayload {
  return {
    action: 'auth_result',
    success: true,
  }
}

/**
 * Creates authentication failure payload
 * @param message - Error message
 * @returns Failure authentication payload
 * @pure
 */
export function createAuthFailurePayload(message: string): AuthenticationPayload {
  return {
    action: 'auth_result',
    success: false,
    message,
  }
}

/**
 * Creates permissions payload from configuration
 * @param config - Application configuration
 * @returns Permissions payload
 * @pure
 */
export function createPermissionsPayload(config: Config): PermissionsPayload {
  return {
    autoLog: !!config.options.autoLog,
    allowReplay: !!config.options.allowReplay,
    allowReconnect: !!config.options.allowReconnect,
    allowReauth: !!config.options.allowReauth,
  }
}

/**
 * Creates connection string for UI display
 * @param host - SSH host
 * @param port - SSH port
 * @returns Connection string
 * @pure
 */
export function buildConnectionString(host: string, port: number): string {
  return `ssh://${host}:${port}`
}

/**
 * Creates UI update payload for footer
 * @param connectionString - Connection string to display
 * @returns UI update payload
 * @pure
 */
export function createUIUpdatePayload(connectionString: string): UIUpdatePayload {
  return {
    element: 'footer',
    value: connectionString,
  }
}

/**
 * Determines appropriate error message for SSH connection failures
 * @param error - SSH connection error
 * @returns User-friendly error message
 * @pure
 */
export function getConnectionErrorMessage(error: Error): string {
  return error instanceof SSHConnectionError
    ? error.message
    : VALIDATION_MESSAGES.SSH_CONNECTION_FAILED
}

/**
 * Clears session credentials on network errors to prevent retry loops
 * @param socket - Socket.IO socket instance
 * @param error - Network error
 */
export function clearSessionOnNetworkError(
  socket: Socket,
  error: Error & { code?: string }
): void {
  debug(
    `Network error detected (${error.code ?? 'unknown'}), clearing session credentials to prevent loop`
  )
  
  const req = socket.request as ExtendedRequest
  if (req.session != null) {
    delete req.session.sshCredentials
    delete req.session.usedBasicAuth
    delete req.session.authMethod
    debug(VALIDATION_MESSAGES.SESSION_CREDENTIALS_CLEARED)
  }
}

/**
 * Updates session credentials after successful authentication
 * @param socket - Socket.IO socket instance
 * @param credentials - New credentials to store
 */
export function updateSessionCredentials(
  socket: Socket,
  credentials: Record<string, unknown>
): void {
  const req = socket.request as ExtendedRequest
  if (req.session != null && hasCompleteSessionCredentials(credentials)) {
    const sessionCreds = extractSessionCredentials(credentials)
    if (sessionCreds != null) {
      debug('Updating session credentials with new user input')
      req.session.sshCredentials = sessionCreds
    }
  }
}

/**
 * Clears authentication failure flag on successful connection
 * @param socket - Socket.IO socket instance
 */
export function clearAuthFailureFlag(socket: Socket): void {
  const req = socket.request as ExtendedRequest
  if (req.session != null) {
    delete req.session.authFailed
  }
}

/**
 * Handles successful SSH connection
 * @param socket - Socket.IO socket instance
 * @param config - Application configuration
 * @param credentials - Connection credentials
 */
export function handleConnectionSuccess(
  socket: Socket,
  config: Config,
  credentials: ConnectionCredentials
): void {
  debug('SSH connection established successfully')
  
  // Clear auth failed flag
  clearAuthFailureFlag(socket)
  
  // Emit success events
  socket.emit('authentication', createAuthSuccessPayload())
  socket.emit('permissions', createPermissionsPayload(config))
  socket.emit('getTerminal', true)
  
  // Update UI with connection info
  const connectionString = buildConnectionString(
    credentials.host ?? 'unknown',
    credentials.port ?? DEFAULTS.SSH_PORT
  )
  socket.emit('updateUI', createUIUpdatePayload(connectionString))
}

/**
 * Handles SSH connection failure
 * @param socket - Socket.IO socket instance
 * @param error - Connection error
 */
export function handleConnectionFailure(
  socket: Socket,
  error: Error & { code?: string }
): void {
  debug(`SSH connection failed: ${error.message}`)
  
  // Clear session credentials on network errors to prevent stuck loops
  if (isNetworkError(error)) {
    clearSessionOnNetworkError(socket, error)
  }
  
  const errorMessage = getConnectionErrorMessage(error)
  socket.emit('authentication', createAuthFailurePayload(errorMessage))
}