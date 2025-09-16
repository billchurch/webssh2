// app/middleware/auth-processor.ts
// Pure functions for authentication processing

import type { Config } from '../types/config.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../types/result.js'
import validator from 'validator'

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
    username: validator.escape(credentials.name ?? ''),
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
  // Check config credentials first
  const configCreds = extractConfigCredentials(config)
  if (configCreds != null) {
    return ok({
      credentials: configCreds,
      usedBasicAuth: true,
      source: 'config'
    })
  }
  
  // Check basic auth credentials
  if (basicAuth == null) {
    return err({
      code: 401,
      message: 'Authentication required'
    })
  }
  
  const processedCreds = processBasicAuthCredentials(basicAuth)
  return ok({
    credentials: processedCreds,
    usedBasicAuth: true,
    source: 'basicAuth'
  })
}

/**
 * Create session data from authentication result
 * Pure function - no side effects
 * 
 * @param authResult - Authentication result
 * @returns Session data object
 */
export function createSessionData(authResult: AuthResult): Record<string, unknown> {
  const sessionData: Record<string, unknown> = {
    sshCredentials: {
      username: authResult.credentials.username
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