// server
// app/auth/auth-utils.ts

import {
  getValidatedHost,
  getValidatedPort,
  maskSensitiveData,
  validateSshTerm,
  parseEnvVars,
  pickField,
} from '../utils.js'
import { DEFAULTS } from '../constants.js'
import { createNamespacedDebug } from '../logger.js'
import type { Config } from '../types/config.js'

const debug = createNamespacedDebug('auth-utils')

export type AuthSession = {
  headerOverride?: { text?: unknown; background?: unknown; style?: unknown }
  sshCredentials?: {
    host?: string
    port?: number
    username?: string
    password?: string
    term?: string | null
  }
  usedBasicAuth?: boolean
  allowReplay?: boolean
  mrhSession?: unknown
  readyTimeout?: number
  authMethod?: string
  envVars?: Record<string, string>
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
 */
export function processHeaderParameters(
  source: Record<string, unknown> | undefined,
  session: AuthSession
): void {
  const src = source ?? {}
  const isGet = !!(
    Object.prototype.hasOwnProperty.call(src, 'header') ||
    Object.prototype.hasOwnProperty.call(src, 'headerBackground') ||
    Object.prototype.hasOwnProperty.call(src, 'headerStyle')
  )

  let headerVal: unknown
  let backgroundVal: unknown
  let styleVal: unknown

  if (isGet) {
    const { header, headerBackground, headerStyle } = src as Record<string, unknown>
    headerVal = header
    backgroundVal = headerBackground
    styleVal = headerStyle
  } else if (source) {
    headerVal = (source as Record<string, unknown>)['header.name']
    backgroundVal = (source as Record<string, unknown>)['header.background']
    const colorVal = (source as Record<string, unknown>)['header.color'] as string | undefined
    styleVal = colorVal ? `color: ${colorVal}` : undefined
  }

  if (headerVal || backgroundVal || styleVal) {
    session.headerOverride ??= {}
    if (headerVal) {
      session.headerOverride.text = headerVal
      debug('Header text from %s: %s', isGet ? 'URL parameter' : 'POST', headerVal)
    }
    if (backgroundVal) {
      session.headerOverride.background = backgroundVal
      debug('Header background from %s: %s', isGet ? 'URL parameter' : 'POST', backgroundVal)
    }
    if (styleVal) {
      session.headerOverride.style = styleVal
      debug('Header style from %s: %s', isGet ? 'URL parameter' : 'POST', styleVal)
    }
    debug('Header override set in session: %O', session.headerOverride)
  }
}

/**
 * Process environment variables from URL query or POST body
 */
export function processEnvironmentVariables(
  source: Record<string, unknown>,
  session: AuthSession
): void {
  const envVars = parseEnvVars((source as Record<string, unknown>)['env'] as string | undefined)
  if (envVars) {
    session.envVars = envVars
    debug('Parsed environment variables: %O', envVars)
  }
}

/**
 * Setup SSH credentials in session with validation
 */
export function setupSshCredentials(
  session: AuthSession,
  opts: { host: string; port: number; username?: string; password?: string; term?: string | null }
): unknown {
  session.sshCredentials ??= {}
  session.sshCredentials.host = opts.host
  session.sshCredentials.port = opts.port
  if (opts.username) {
    session.sshCredentials.username = opts.username
  }
  if (opts.password) {
    session.sshCredentials.password = opts.password
  }
  if (opts.term) {
    session.sshCredentials.term = opts.term
  }
  session.usedBasicAuth = true

  const sanitized = maskSensitiveData(JSON.parse(JSON.stringify(session.sshCredentials))) as unknown
  return sanitized
}

/**
 * Process session recording parameters
 */
export function processSessionRecordingParams(
  body: Record<string, unknown>,
  session: AuthSession
): void {
  if (body['allowreplay'] === 'true' || body['allowreplay'] === true) {
    session.allowReplay = true
  }
  if (body['mrhsession']) {
    session.mrhSession = body['mrhsession']
  }
  if (body['readyTimeout']) {
    session.readyTimeout = parseInt(body['readyTimeout'] as string, 10)
  }
}

/**
 * Validate connection parameters (host, port, term)
 */
export function validateConnectionParams(params: {
  host?: string | undefined
  port?: string | number | undefined
  sshterm?: string | undefined
  hostParam?: string | undefined
  config?: Config | undefined
}): { host: string; port: number; term: string | null } {
  let host: string

  if (params.hostParam) {
    host = getValidatedHost(params.hostParam)
  } else if (params.host) {
    host = getValidatedHost(params.host)
  } else if (params.config?.ssh.host) {
    host = params.config.ssh.host
  } else {
    throw new Error('Host parameter required when default host not configured')
  }

  const port = getValidatedPort(params.port as string | undefined)
  const term = validateSshTerm(params.sshterm as string | undefined)

  return { host, port, term }
}

/**
 * Extract credentials from POST body with header support
 */
export function extractPostCredentials(
  body: Record<string, unknown>,
  headers: Record<string, unknown>
): { username?: string; password?: string } {
  const username = pickField(
    body['username'] as string | undefined,
    headers[DEFAULTS.SSO_HEADERS.USERNAME] as string | undefined
  )
  const password = pickField(
    body['password'] as string | undefined,
    headers[DEFAULTS.SSO_HEADERS.PASSWORD] as string | undefined
  )

  const result: { username?: string; password?: string } = {}
  if (username) {
    result.username = username
  }
  if (password) {
    result.password = password
  }
  return result
}

/**
 * Process all authentication parameters from source (query/body)
 */
export function processAuthParameters(source: Record<string, unknown>, session: AuthSession): void {
  processHeaderParameters(source, session)
  processEnvironmentVariables(source, session)
  processSessionRecordingParams(source, session)
}
