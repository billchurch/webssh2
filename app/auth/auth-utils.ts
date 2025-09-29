// app/auth/auth-utils.ts
// Orchestration layer for authentication utilities
// Delegates to pure function modules for business logic

import { pickField } from '../utils/index.js'
import { DEFAULTS } from '../constants.js'
import { createNamespacedDebug } from '../logger.js'
import type { Config } from '../types/config.js'

// Re-export types from pure modules
export type { 
  HeaderOverride, 
  HeaderValues, 
  SourceType 
} from './header-processor.js'

export type {
  SshCredentials,
  ConnectionParams,
  ValidatedConnection
} from './credential-processor.js'

export type {
  RecordingParams
} from './session-processor.js'

// Import pure functions
import {
  processHeaderParams,
  type HeaderOverride
} from './header-processor.js'

import {
  extractPostCredentials as extractPostCredentialsPure,
  validateConnectionParams as validateConnectionParamsPure,
  createSshCredentials,
  maskCredentials,
  extractReadyTimeout,
  type SshCredentials
} from './credential-processor.js'

import {
  extractEnvironmentVars,
  extractRecordingParams
} from './session-processor.js'

const debug = createNamespacedDebug('auth-utils')

// Legacy interface for backward compatibility
export interface AuthSession {
  headerOverride?: HeaderOverride
  sshCredentials?: SshCredentials
  usedBasicAuth?: boolean
  allowReplay?: boolean
  mrhSession?: unknown
  readyTimeout?: number
  authMethod?: string
  envVars?: Record<string, string>
  replayDateStart?: Date
  replayDateEnd?: Date
  replayExitCode?: number
  replayExitSignal?: string
  sessionId?: string
  sessionUsername?: string
  userHash?: string
  [k: string]: unknown
}

export interface AuthCredentials {
  host: string
  port: number
  username?: string
  password?: string
  term?: string | null
}

/**
 * Process header customization parameters from URL query or POST body
 * Wrapper for backward compatibility - mutates session
 */
export function processHeaderParameters(
  source: Record<string, unknown> | undefined,
  session: AuthSession
): void {
  const override = processHeaderParams(source)
  
  if (override != null) {
    session.headerOverride = {
      ...session.headerOverride,
      ...override
    }
    debug('Header override set in session: %O', override)
  }
}

/**
 * Process environment variables from URL query or POST body
 * Wrapper for backward compatibility - mutates session
 */
export function processEnvironmentVariables(
  source: Record<string, unknown>,
  session: AuthSession
): void {
  const envVars = extractEnvironmentVars(source)
  if (envVars != null) {
    session.envVars = envVars
  }
}

/**
 * Setup SSH credentials in session with validation
 * Wrapper for backward compatibility - mutates session
 */
export function setupSshCredentials(
  session: AuthSession,
  opts: { host: string; port: number; username?: string; password?: string; term?: string | null }
): unknown {
  const credentials = createSshCredentials(
    opts.username ?? '',
    opts.password ?? '',
    opts.host,
    opts.port,
    opts.term
  )
  
  session.sshCredentials = credentials
  session.usedBasicAuth = true
  
  return maskCredentials(credentials)
}

/**
 * Process session recording parameters
 * Wrapper for backward compatibility - mutates session
 */
export function processSessionRecordingParams(
  body: Record<string, unknown>,
  session: AuthSession
): void {
  const recording = extractRecordingParams(body)
  
  applyWhenDefined(recording.allowReplay, value => {
    session.allowReplay = value
  })
  applyWhenDefined(recording.mrhSession, value => {
    session.mrhSession = value
  })
  applyWhenDefined(recording.replayDateStart, value => {
    session.replayDateStart = value
  })
  applyWhenDefined(recording.replayDateEnd, value => {
    session.replayDateEnd = value
  })
  applyWhenDefined(recording.replayExitCode, value => {
    session.replayExitCode = value
  })
  applyWhenDefined(recording.replayExitSignal, value => {
    session.replayExitSignal = value
  })
  applyWhenDefined(recording.sessionId, value => {
    session.sessionId = value
  })
  applyWhenDefined(recording.sessionUsername, value => {
    session.sessionUsername = value
  })
  applyWhenDefined(recording.userHash, value => {
    session.userHash = value
  })
  
  // Also check for readyTimeout
  const timeout = extractReadyTimeout(body)
  if (timeout != null) {
    session.readyTimeout = timeout
  }
}

function applyWhenDefined<T>(value: T | undefined, apply: (definedValue: T) => void): void {
  if (value !== undefined) {
    apply(value)
  }
}

/**
 * Validate connection parameters (host, port, term)
 * Wrapper for backward compatibility
 */
export function validateConnectionParams(params: {
  host?: string | undefined
  port?: number | undefined
  sshterm?: string | undefined
  hostParam?: string | undefined
  config?: Config | undefined
}): { host: string; port: number; term: string | null } {
  if (params.config == null) {
    throw new Error('Config is required for connection validation')
  }
  
  return validateConnectionParamsPure({
    host: params.host,
    hostParam: params.hostParam,
    port: params.port,
    sshterm: params.sshterm,
    config: params.config
  })
}

/**
 * Extract credentials from POST body with header support
 * Wrapper for backward compatibility
 */
export function extractPostCredentials(
  body: Record<string, unknown>,
  headers: Record<string, unknown>
): { username?: string; password?: string } {
  // First try to extract from body
  const bodyCredentials = extractPostCredentialsPure(body)
  
  if (bodyCredentials?.username != null && bodyCredentials.username !== '' &&
      bodyCredentials.password != null && bodyCredentials.password !== '') {
    return {
      username: bodyCredentials.username,
      password: bodyCredentials.password
    }
  }
  
  // Fall back to headers
  const username = pickField(
    body['username'] as string | undefined,
    headers[DEFAULTS.SSO_HEADERS.USERNAME] as string | undefined
  )
  const password = pickField(
    body['password'] as string | undefined,
    headers[DEFAULTS.SSO_HEADERS.PASSWORD] as string | undefined
  )

  const result: { username?: string; password?: string } = {}
  if (username != null && username !== '') {
    result.username = username
  }
  if (password != null && password !== '') {
    result.password = password
  }
  return result
}

/**
 * Process all authentication parameters from source (query/body)
 * Wrapper for backward compatibility
 */
export function processAuthParameters(source: Record<string, unknown>, session: AuthSession): void {
  processHeaderParameters(source, session)
  processEnvironmentVariables(source, session)
  processSessionRecordingParams(source, session)
}
