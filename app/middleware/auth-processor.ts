// app/middleware/auth-processor.ts
// Pure functions for authentication processing

import type { Config } from '../types/config.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/index.js'
import escape from 'validator/lib/escape.js'

/**
 * SSH Credentials structure
 */
export interface SshCredentials {
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
}

/**
 * Authentication result with credentials and metadata
 */
export interface AuthResult {
  credentials: SshCredentials
  usedBasicAuth: boolean
  source: 'config' | 'basicAuth'
}

/**
 * Basic auth credentials from request
 */
export interface BasicAuthCredentials {
  name?: string
  pass?: string
}

/**
 * Check if config has valid user credentials
 * Pure function - no side effects
 * 
 * @param config - Application configuration
 * @returns True if config contains valid credentials
 */
export function hasConfigCredentials(config: Config): boolean {
  const hasUsername = config.user.name != null && config.user.name !== ''
  const hasPassword = config.user.password != null && config.user.password !== ''
  const hasPrivateKey = config.user.privateKey != null && config.user.privateKey !== ''
  
  return hasUsername && (hasPassword || hasPrivateKey)
}

/**
 * Extract credentials from configuration
 * Pure function - no side effects
 * 
 * @param config - Application configuration
 * @returns SSH credentials from config or null
 */
export function extractConfigCredentials(config: Config): SshCredentials | null {
  if (!hasConfigCredentials(config)) {
    return null
  }
  
  const creds: SshCredentials = {
    username: config.user.name ?? ''
  }
  
  if (config.user.password != null && config.user.password !== '') {
    creds.password = config.user.password
  }
  
  if (config.user.privateKey != null && config.user.privateKey !== '') {
    creds.privateKey = config.user.privateKey
  }
  
  if (config.user.passphrase != null && config.user.passphrase !== '') {
    creds.passphrase = config.user.passphrase
  }
  
  return creds
}

/**
 * Error message returned when a request tries to send server-configured
 * credentials to a host or port other than the configured `ssh.host`/`ssh.port`
 */
export const CONFIG_CREDENTIALS_TARGET_ERROR =
  'Server-configured credentials can only be used for the configured SSH host and port'

/**
 * Check if a host/port pair is the operator-configured SSH target.
 * Server-configured credentials (`user.*`) may only be sent to this target.
 * Pure function - no side effects
 *
 * @param config - Application configuration
 * @param host - Requested SSH host
 * @param port - Requested SSH port
 * @returns True only when `ssh.host` is set and both host and port match it
 */
export function isConfiguredSshTarget(
  config: Config,
  host: string | null | undefined,
  port: number | null | undefined
): boolean {
  const configuredHost = config.ssh.host
  if (configuredHost == null || configuredHost === '' || host == null || host === '') {
    return false
  }

  return host.toLowerCase() === configuredHost.toLowerCase() && port === config.ssh.port
}

/**
 * Check if session credentials were loaded from server configuration
 * Pure function - no side effects
 *
 * @param credentials - Session SSH credentials
 * @returns True when the credentials carry the server-configured marker
 */
export function isConfigCredentialSource(credentials: unknown): boolean {
  if (credentials == null || typeof credentials !== 'object') {
    return false
  }
  return (credentials as Record<string, unknown>)['credentialSource'] === 'config'
}

/**
 * Process basic auth credentials
 * Pure function - no side effects
 * 
 * @param credentials - Basic auth credentials
 * @returns Processed SSH credentials
 */
export function processBasicAuthCredentials(
  credentials: BasicAuthCredentials
): SshCredentials {
  return {
    username: escape(credentials.name ?? ''),
    password: credentials.pass ?? ''
  }
}

/**
 * Process authentication from config or basic auth
 * Pure function - returns Result type
 * 
 * @param config - Application configuration
 * @param basicAuth - Optional basic auth credentials
 * @returns Result with auth credentials or error
 */
export function processAuthentication(
  config: Config,
  basicAuth?: BasicAuthCredentials | null
): Result<AuthResult, { code: number; message: string }> {
  // Basic Auth takes precedence over config credentials
  if (basicAuth != null) {
    const processedCreds = processBasicAuthCredentials(basicAuth)
    return ok({
      credentials: processedCreds,
      usedBasicAuth: true,
      source: 'basicAuth'
    })
  }
  
  // Check config credentials as fallback
  const configCreds = extractConfigCredentials(config)
  if (configCreds != null) {
    return ok({
      credentials: configCreds,
      usedBasicAuth: true,
      source: 'config'
    })
  }
  
  // No credentials available
  return err({
    code: 401,
    message: 'Authentication required'
  })
}

/**
 * Create session data from authentication result
 * Pure function - no side effects
 *
 * @param authResult - Authentication result
 * @param config - Application configuration for SSH host/port
 * @returns Session data object
 */
export function createSessionData(
  authResult: AuthResult,
  config: Config
): Record<string, unknown> {
  const sessionData: Record<string, unknown> = {
    sshCredentials: {
      username: authResult.credentials.username,
      host: config.ssh.host,
      port: config.ssh.port,
      // Marks server-configured credentials so they stay pinned to ssh.host/ssh.port
      ...(authResult.source === 'config' ? { credentialSource: 'config' } : {})
    },
    usedBasicAuth: authResult.usedBasicAuth
  }

  const creds = sessionData['sshCredentials'] as Record<string, unknown>

  if (authResult.credentials.password != null && authResult.credentials.password !== '') {
    creds['password'] = authResult.credentials.password
  }

  if (authResult.credentials.privateKey != null && authResult.credentials.privateKey !== '') {
    creds['privateKey'] = authResult.credentials.privateKey
  }

  if (authResult.credentials.passphrase != null && authResult.credentials.passphrase !== '') {
    creds['passphrase'] = authResult.credentials.passphrase
  }

  return sessionData
}