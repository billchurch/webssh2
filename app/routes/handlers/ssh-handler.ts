// app/routes/handlers/ssh-handler.ts
// Pure functions for SSH route handling logic

import type { Result } from '../../types/result.js'
import type { Config } from '../../types/config.js'
import type { AuthSession } from '../../auth/auth-utils.js'
import type { SshValidationResult } from '../../connection/index.js'
import { HTTP } from '../../constants/index.js'

export interface SshRouteRequest {
  session: AuthSession
  query: Record<string, unknown>
  params: Record<string, string>
  body?: Record<string, unknown>
  headers: Record<string, unknown>
}

export interface SshConnectionParams {
  host: string
  port: number
  term: string | null
}

export interface SshRouteResponse {
  status: number
  headers?: Record<string, string>
  data?: unknown
  redirect?: string
}

export interface SshCredentials {
  username: string
  password: string
  privateKey?: string
  passphrase?: string
}

/**
 * Validate SSH route request has required credentials
 */
export const validateSshRouteCredentials = (
  credentials: unknown
): Result<SshCredentials> => {
  if (credentials == null || typeof credentials !== 'object') {
    return { 
      ok: false, 
      error: new Error('Missing SSH credentials in session')
    }
  }

  const creds = credentials as Record<string, unknown>
  
  if (typeof creds['username'] !== 'string' || creds['username'] === '') {
    return {
      ok: false,
      error: new Error('Invalid or missing username')
    }
  }

  // Password or private key required
  const hasPassword = typeof creds['password'] === 'string' && creds['password'] !== ''
  const hasPrivateKey = typeof creds['privateKey'] === 'string' && creds['privateKey'] !== ''
  
  if (!hasPassword && !hasPrivateKey) {
    return {
      ok: false,
      error: new Error('Either password or private key required')
    }
  }

  return {
    ok: true,
    value: {
      username: String(creds['username']),
      password: creds['password'] as string,
      privateKey: creds['privateKey'] as string,
      passphrase: creds['passphrase'] as string
    }
  }
}

/**
 * Process SSH route validation result into response
 */
export const processSshValidationResult = (
  result: SshValidationResult,
  host: string,
  port: number
): SshRouteResponse => {
  if (result.success) {
    return {
      status: HTTP.OK,
      data: { validated: true }
    }
  }

  // Map validation error types to HTTP responses
  switch (result.errorType) {
    case 'auth':
      return {
        status: HTTP.UNAUTHORIZED,
        headers: { [HTTP.AUTHENTICATE]: HTTP.REALM },
        data: {
          error: 'Authentication failed',
          message: result.errorMessage,
          host,
          port
        }
      }

    case 'network':
      return {
        status: HTTP.BAD_GATEWAY,
        data: {
          error: 'Connection failed',
          message: result.errorMessage,
          host,
          port
        }
      }

    case 'timeout':
      return {
        status: HTTP.GATEWAY_TIMEOUT,
        data: {
          error: 'Connection timeout',
          message: result.errorMessage,
          host,
          port
        }
      }

    case undefined:
    case 'unknown':
    default:
      return {
        status: HTTP.INTERNAL_SERVER_ERROR,
        data: {
          error: 'SSH validation failed',
          message: result.errorMessage ?? 'Unknown error',
          host,
          port
        }
      }
  }
}

/**
 * Process POST authentication request
 */
export const processPostAuthRequest = (
  body: Record<string, unknown>,
  query: Record<string, unknown>,
  config: Config
): Result<{
  credentials: SshCredentials
  connection: SshConnectionParams
}> => {
  const normalizedBody = toPlainRecord(body)
  const credentialsResult = extractCredentials(normalizedBody)
  if (!credentialsResult.ok) {
    return credentialsResult
  }

  const connectionResult = buildConnectionParams(normalizedBody, query, config)
  if (!connectionResult.ok) {
    return connectionResult
  }

  return {
    ok: true,
    value: {
      credentials: credentialsResult.value,
      connection: connectionResult.value
    }
  }
}

/**
 * Create session updates from successful authentication
 */
export const createAuthSessionUpdates = (
  credentials: SshCredentials,
  connection: SshConnectionParams
): Record<string, unknown> => {
  return {
    sshCredentials: {
      ...credentials,
      host: connection.host,
      port: connection.port,
      term: connection.term
    },
    sshHost: connection.host,
    sshPort: connection.port,
    sshterm: connection.term ?? undefined,
    authMethod: 'POST'
  }
}

/**
 * Process re-authentication request
 */
export const processReauthRequest = (
  session: AuthSession
): { keysToRemove: string[], redirectPath: string } => {
  const standardKeys = [
    'sshCredentials',
    'privateKey', 
    'passphrase',
    'username',
    'userpassword',
    'sshhost',
    'sshport',
    'sshterm'
  ]

  // Find any additional auth-related keys
  const sessionKeys = Object.keys(session)
  const authRelatedKeys = sessionKeys.filter(key => 
    key.toLowerCase().includes('auth') || 
    key.toLowerCase().includes('ssh')
  )

  const allKeysToRemove = [...new Set([...standardKeys, ...authRelatedKeys])]

  return {
    keysToRemove: allKeysToRemove,
    redirectPath: '/ssh'
  }
}

/**
 * Validate connection parameters
 */
export const validateConnectionParameters = (
  params: {
    host?: string
    port?: string | number
    term?: string
  },
  config: Config
): Result<SshConnectionParams> => {
  const host = params.host ?? config.ssh.host
  if (host == null || host === '') {
    return {
      ok: false,
      error: new Error('Missing required field: host')
    }
  }

  let port: number
  if (typeof params.port === 'number') {
    port = params.port
  } else if (typeof params.port === 'string') {
    port = Number.parseInt(params.port, 10)
    if (Number.isNaN(port) || port <= 0 || port > 65535) {
      return {
        ok: false,
        error: new Error(`Invalid port: ${params.port}`)
      }
    }
  } else {
    port = config.ssh.port
  }

  return {
    ok: true,
    value: {
      host,
      port,
      term: params.term ?? null
    }
  }
}

/**
 * Create sanitized credentials for logging
 */
export const sanitizeCredentialsForLogging = (
  credentials: SshCredentials,
  connection: SshConnectionParams
): Record<string, unknown> => {
  return {
    username: credentials.username,
    host: connection.host,
    port: connection.port,
    hasPassword: credentials.password !== '',
    hasPrivateKey: credentials.privateKey != null && credentials.privateKey !== '',
    term: connection.term
  }
}

const extractCredentials = (
  body: Record<string, unknown>
): Result<SshCredentials> => {
  const username = toFilledString(body['username'])
  const password = toFilledString(body['password'])

  if (username === undefined || password === undefined) {
    return {
      ok: false,
      error: new Error('Missing required fields: username and password')
    }
  }

  return {
    ok: true,
    value: {
      username,
      password
    }
  }
}

const buildConnectionParams = (
  body: Record<string, unknown>,
  query: Record<string, unknown>,
  config: Config
): Result<SshConnectionParams> => {
  const hostCandidate = firstDefinedString([
    body['host'],
    query['host'],
    query['hostname']
  ])

  const portCandidate = firstDefinedPortCandidate([
    body['port'],
    query['port']
  ])

  const termCandidate = firstDefinedString([
    body['sshterm'],
    query['sshterm']
  ])

  const parameters: {
    host?: string
    port?: string | number
    term?: string
  } = {}

  if (hostCandidate !== undefined) {
    parameters.host = hostCandidate
  }
  if (portCandidate !== undefined) {
    parameters.port = portCandidate
  }
  if (termCandidate !== undefined) {
    parameters.term = termCandidate
  }

  return validateConnectionParameters(parameters, config)
}

const firstDefinedString = (candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    const value = toFilledString(candidate)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

const firstDefinedPortCandidate = (candidates: unknown[]): string | number | undefined => {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue
    }

    if (typeof candidate === 'number') {
      return candidate
    }

    if (typeof candidate === 'string' && candidate !== '') {
      return candidate
    }
  }
  return undefined
}

const toFilledString = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  return value
}

const toPlainRecord = (value: Record<string, unknown> | null | undefined): Record<string, unknown> => {
  if (value === undefined || value === null) {
    return {}
  }
  return value
}
