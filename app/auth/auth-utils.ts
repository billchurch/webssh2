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

// Type-safe header interfaces
export interface HeaderOverride {
  text?: string
  background?: string
  style?: string
}

export interface HeaderValues {
  header?: unknown
  background?: unknown
  color?: unknown
}

export enum SourceType {
  GET = 'GET',
  POST = 'POST',
  NONE = 'NONE'
}

export type HeaderSource = Record<string, unknown>

export interface AuthSession {
  headerOverride?: HeaderOverride
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
 * Detect the source type based on property names
 * @pure
 */
function detectSourceType(source: HeaderSource | undefined): SourceType {
  if (source == null) {return SourceType.NONE}
  
  const hasGetParams = 
    Object.hasOwn(source, 'header') ||
    Object.hasOwn(source, 'headerBackground') ||
    Object.hasOwn(source, 'headerStyle')
  
  if (hasGetParams) {return SourceType.GET}
  
  const hasPostParams = 
    Object.hasOwn(source, 'header.name') ||
    Object.hasOwn(source, 'header.background') ||
    Object.hasOwn(source, 'header.color')
  
  return hasPostParams ? SourceType.POST : SourceType.NONE
}

/**
 * Extract header values based on source type
 * @pure
 */
function extractHeaderValues(
  source: HeaderSource | undefined,
  sourceType: SourceType
): HeaderValues {
  if (source == null || sourceType === SourceType.NONE) {
    return {}
  }

  if (sourceType === SourceType.GET) {
    return {
      header: source['header'],
      background: source['headerBackground'],
      color: source['headerStyle']
    }
  }

  // POST format
  return {
    header: source['header.name'],
    background: source['header.background'],
    color: source['header.color']
  }
}

/**
 * Validate and transform a header value
 * @pure
 */
function validateHeaderValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }
  // Only convert primitives to string, not objects
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return undefined
}

/**
 * Transform color value to CSS style
 * @pure
 */
function colorToStyle(color: unknown): string | undefined {
  const validated = validateHeaderValue(color)
  if (validated == null) {return undefined}
  
  // If it already looks like a style, return as-is
  if (validated.includes(':')) {return validated}
  
  // Otherwise, treat as color value
  return `color: ${validated}`
}

/**
 * Create a header override object from raw values
 * @pure
 */
function createHeaderOverride(
  values: HeaderValues,
  sourceType: SourceType
): HeaderOverride | null {
  const text = validateHeaderValue(values.header)
  const background = validateHeaderValue(values.background)
  const style = sourceType === SourceType.GET 
    ? validateHeaderValue(values.color)
    : colorToStyle(values.color)

  if (text == null && background == null && style == null) {
    return null
  }

  const override: HeaderOverride = {}
  if (text != null) {override.text = text}
  if (background != null) {override.background = background}
  if (style != null) {override.style = style}
  
  return override
}

/**
 * Apply header override to session (creates new session)
 * @pure
 */
function applyHeaderOverride(
  session: AuthSession,
  override: HeaderOverride
): AuthSession {
  return {
    ...session,
    headerOverride: {
      ...session.headerOverride,
      ...override
    }
  }
}

/**
 * Log header debug information
 */
function logHeaderDebug(
  override: HeaderOverride,
  sourceType: SourceType
): void {
  const sourceLabel = sourceType === SourceType.GET ? 'URL parameter' : 'POST'
  
  if (override.text != null) {
    debug('Header text from %s: %s', sourceLabel, override.text)
  }
  if (override.background != null) {
    debug('Header background from %s: %s', sourceLabel, override.background)
  }
  if (override.style != null) {
    debug('Header style from %s: %s', sourceLabel, override.style)
  }
  debug('Header override set in session: %O', override)
}

/**
 * Process header customization parameters from URL query or POST body
 * Orchestrates pure functions to extract, validate, and apply header overrides
 */
export function processHeaderParameters(
  source: HeaderSource | undefined,
  session: AuthSession
): void {
  const sourceType = detectSourceType(source)
  if (sourceType === SourceType.NONE) {return}
  
  const values = extractHeaderValues(source, sourceType)
  const override = createHeaderOverride(values, sourceType)
  
  if (override != null) {
    logHeaderDebug(override, sourceType)
    // Mutation required for backward compatibility
    // Consider returning new session in future refactor
    Object.assign(session, applyHeaderOverride(session, override))
  }
}

/**
 * Process environment variables from URL query or POST body
 */
export function processEnvironmentVariables(
  source: Record<string, unknown>,
  session: AuthSession
): void {
  const envVars = parseEnvVars((source)['env'] as string | undefined)
  if (envVars != null) {
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
  if (opts.username != null && opts.username !== '') {
    session.sshCredentials.username = opts.username
  }
  if (opts.password != null && opts.password !== '') {
    session.sshCredentials.password = opts.password
  }
  if (opts.term !== null && opts.term !== undefined && opts.term !== '') {
    session.sshCredentials.term = opts.term
  }
  session.usedBasicAuth = true

  const sanitized = maskSensitiveData(JSON.parse(JSON.stringify(session.sshCredentials)))
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
  if (body['mrhsession'] !== null && body['mrhsession'] !== undefined) {
    session.mrhSession = body['mrhsession']
  }
  if (body['readyTimeout'] !== null && body['readyTimeout'] !== undefined) {
    session.readyTimeout = parseInt(body['readyTimeout'] as string, 10)
  }
}

/**
 * Validate connection parameters (host, port, term)
 */
export function validateConnectionParams(params: {
  host?: string | undefined
  port?: number | undefined
  sshterm?: string | undefined
  hostParam?: string | undefined
  config?: Config | undefined
}): { host: string; port: number; term: string | null } {
  let host: string

  if (params.hostParam != null && params.hostParam !== '') {
    host = getValidatedHost(params.hostParam)
  } else if (params.host != null && params.host !== '') {
    host = getValidatedHost(params.host)
  } else if (params.config?.ssh.host != null && params.config.ssh.host !== '') {
    host = params.config.ssh.host
  } else {
    throw new Error('Host parameter required when default host not configured')
  }

  const port = getValidatedPort(params.port)
  const term = validateSshTerm(params.sshterm)

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
 */
export function processAuthParameters(source: Record<string, unknown>, session: AuthSession): void {
  processHeaderParameters(source, session)
  processEnvironmentVariables(source, session)
  processSessionRecordingParams(source, session)
}
