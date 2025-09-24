// app/auth/credential-processor.ts
// Pure functions for processing SSH credentials

import { 
  getValidatedHost,
  getValidatedPort,
  validateSshTerm,
  maskSensitiveData
} from '../utils.js'
import type { Config } from '../types/config.js'

/**
 * SSH credentials structure
 */
export interface SshCredentials {
  host?: string
  port?: number
  username?: string
  password?: string
  privateKey?: string
  passphrase?: string
  term?: string | null
  [k: string]: unknown // For backward compatibility
}

/**
 * Connection parameters for validation
 */
export interface ConnectionParams {
  host?: string | undefined
  hostParam?: string | undefined
  port?: number | undefined
  sshterm?: string | undefined
  config: Config
}

/**
 * Validated connection result
 */
export interface ValidatedConnection {
  host: string
  port: number
  term: string | null
}

/**
 * Extract credentials from POST body
 * Pure function - no side effects
 */
export function extractPostCredentials(body: Record<string, unknown>): SshCredentials | null {
  const username = body['username']
  const password = body['password']
  
  if (typeof username !== 'string' || username === '' ||
      typeof password !== 'string' || password === '') {
    return null
  }
  
  const credentials: SshCredentials = {
    username,
    password
  }
  
  // Optional fields
  const host = body['host'] ?? body['hostname']
  if (typeof host === 'string' && host !== '') {
    credentials.host = host
  }
  
  const port = body['port']
  if (typeof port === 'number' || typeof port === 'string') {
    credentials.port = typeof port === 'number' ? port : Number.parseInt(port, 10)
  }
  
  const sshterm = body['sshterm']
  if (typeof sshterm === 'string') {
    credentials.term = validateSshTerm(sshterm)
  }
  
  return credentials
}

/**
 * Validate connection parameters
 * Pure function - no side effects
 */
export function validateConnectionParams(params: ConnectionParams): ValidatedConnection {
  // Determine host
  let host: string
  if (params.hostParam != null && params.hostParam !== '') {
    host = getValidatedHost(params.hostParam)
  } else if (params.host != null && params.host !== '') {
    host = getValidatedHost(params.host)
  } else if (params.config.ssh.host != null && params.config.ssh.host !== '') {
    host = params.config.ssh.host
  } else {
    throw new Error('Host is required but not provided')
  }
  
  // Determine port
  const port = getValidatedPort(params.port)
  
  // Determine terminal
  const term = params.sshterm == null
    ? params.config.ssh.term
    : validateSshTerm(params.sshterm)
  
  return { host, port, term }
}

/**
 * Create SSH credentials for session
 * Pure function - no side effects
 */
export function createSshCredentials(
  username: string,
  password: string,
  host: string,
  port: number,
  term?: string | null
): SshCredentials {
  const credentials: SshCredentials = {
    username,
    password,
    host,
    port
  }
  
  if (term != null && term !== '') {
    credentials.term = term
  }
  
  return credentials
}

/**
 * Mask sensitive data in credentials
 * Pure function wrapper
 */
export function maskCredentials(credentials: SshCredentials): unknown {
  return maskSensitiveData(credentials)
}

/**
 * Validate credential format
 * Pure function - no side effects
 */
export function isValidCredentialFormat(creds: unknown): boolean {
  if (typeof creds !== 'object' || creds == null) {
    return false
  }
  
  const obj = creds as Record<string, unknown>
  
  // Required fields
  const hasUsername = typeof obj['username'] === 'string' && obj['username'] !== ''
  const hasAuth = 
    (typeof obj['password'] === 'string' && obj['password'] !== '') ||
    (typeof obj['privateKey'] === 'string' && obj['privateKey'] !== '')
  
  return hasUsername && hasAuth
}

/**
 * Extract ready timeout from parameters
 * Pure function - no side effects
 */
export function extractReadyTimeout(params: Record<string, unknown>): number | null {
  const timeout = params['readyTimeout']
  
  if (typeof timeout === 'number' && timeout > 0) {
    return Math.min(timeout, 300000) // Max 5 minutes
  }
  
  if (typeof timeout === 'string') {
    const parsed = Number.parseInt(timeout, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return Math.min(parsed, 300000) // Max 5 minutes
    }
  }
  
  return null
}