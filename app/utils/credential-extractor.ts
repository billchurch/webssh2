// app/utils/credential-extractor.ts
// Pure functions for extracting and validating SSH credentials

import type { Result } from '../types/result.js'
import type { AuthCredentials } from '../types/contracts/v1/socket.js'
import { ok, err } from './result.js'

/**
 * Terminal settings that can be extracted from credentials
 */
export interface TerminalSettings {
  term?: string
  cols?: number
  rows?: number
}

/**
 * Required credential fields
 */
interface RequiredFields {
  username: string
  host: string
  port: number
}

/**
 * SSH Authentication method type
 */
export type SSHAuthMethod = 'password' | 'privateKey' | 'both' | 'none'

/**
 * Credential validation error
 */
export class CredentialError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'CredentialError'
  }
}

interface AuthenticationFields {
  password?: string
  privateKey?: string
  passphrase?: string
}

function getNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  return value === '' ? undefined : value
}

function buildAuthenticationFields(raw: Record<string, unknown>): Result<AuthenticationFields, CredentialError> {
  const passwordValue = getNonEmptyString(raw['password'])
  const privateKeyValue = getNonEmptyString(raw['privateKey'])

  if (passwordValue === undefined && privateKeyValue === undefined) {
    return err(new CredentialError('Either password or privateKey is required for authentication'))
  }

  const passphraseValue = privateKeyValue !== undefined ? getNonEmptyString(raw['passphrase']) : undefined
  const fields: AuthenticationFields = {}

  if (passwordValue !== undefined) {
    fields.password = passwordValue
  }

  if (privateKeyValue !== undefined) {
    fields.privateKey = privateKeyValue

    if (passphraseValue !== undefined) {
      fields.passphrase = passphraseValue
    }
  }

  return ok(fields)
}

function createBaseCredentials(
  required: RequiredFields,
  authFields: AuthenticationFields
): AuthCredentials {
  return {
    username: required.username,
    host: required.host,
    port: required.port,
    ...authFields
  }
}

function mergeTerminalSettings(
  credentials: AuthCredentials,
  settings: TerminalSettings
): AuthCredentials {
  return {
    ...credentials,
    ...(settings.term !== undefined ? { term: settings.term } : {}),
    ...(settings.cols !== undefined ? { cols: settings.cols } : {}),
    ...(settings.rows !== undefined ? { rows: settings.rows } : {})
  }
}

/**
 * Validate and extract required credential fields
 * @param raw - Raw credential data
 * @returns Result with required fields or error
 * @pure
 */
export function validateRequiredFields(raw: Record<string, unknown>): Result<RequiredFields, CredentialError> {
  const username = raw['username']
  const host = raw['host']
  let port = raw['port'] ?? 22

  // Convert string port to number if needed
  if (typeof port === 'string') {
    port = Number.parseInt(port, 10)
  }

  // Validate username
  if (typeof username !== 'string' || username === '') {
    return err(new CredentialError('Username is required and must be a non-empty string', 'username'))
  }

  // Validate host
  if (typeof host !== 'string' || host === '') {
    return err(new CredentialError('Host is required and must be a non-empty string', 'host'))
  }

  // Validate port
  if (typeof port !== 'number' || Number.isNaN(port) || port <= 0 || port > 65535) {
    return err(new CredentialError('Port must be a number between 1 and 65535', 'port'))
  }

  return ok({ username, host, port })
}

/**
 * Extract authentication method from credentials
 * @param raw - Raw credential data
 * @returns Authentication method
 * @pure
 */
export function extractAuthMethod(raw: Record<string, unknown>): SSHAuthMethod {
  const password = raw['password']
  const privateKey = raw['privateKey']

  const hasPassword = typeof password === 'string' && password !== ''
  const hasPrivateKey = typeof privateKey === 'string' && privateKey !== ''

  if (hasPassword && hasPrivateKey) {
    return 'both'
  } else if (hasPassword) {
    return 'password'
  } else if (hasPrivateKey) {
    return 'privateKey'
  } else {
    return 'none'
  }
}

/**
 * Extract optional terminal settings from credentials
 * @param raw - Raw credential data
 * @returns Terminal settings (never null)
 * @pure
 */
export function extractOptionalTerminalSettings(raw: Record<string, unknown>): TerminalSettings {
  const settings: TerminalSettings = {}

  // Extract terminal type
  const term = raw['term']
  if (typeof term === 'string' && term !== '') {
    settings.term = term
  }

  // Extract columns
  const cols = raw['cols']
  if (typeof cols === 'number' && cols > 0) {
    settings.cols = cols
  }

  // Extract rows
  const rows = raw['rows']
  if (typeof rows === 'number' && rows > 0) {
    settings.rows = rows
  }

  return settings
}

/**
 * Extract and validate authentication credentials from raw data
 * @param raw - Raw credential data
 * @returns Result with AuthCredentials or error
 * @pure
 */
export function extractAuthCredentials(raw: Record<string, unknown>): Result<AuthCredentials, CredentialError> {
  const requiredResult = validateRequiredFields(raw)
  if (!requiredResult.ok) {
    return err(requiredResult.error)
  }

  const authFieldsResult = buildAuthenticationFields(raw)
  if (!authFieldsResult.ok) {
    return err(authFieldsResult.error)
  }

  const credentials = createBaseCredentials(requiredResult.value, authFieldsResult.value)
  const terminalSettings = extractOptionalTerminalSettings(raw)
  const merged = mergeTerminalSettings(credentials, terminalSettings)

  return ok(merged)
}

/**
 * Convert Credentials (all optional) to AuthCredentials format
 * This is a compatibility function for existing auth providers
 * @param raw - Raw credential data
 * @returns AuthCredentials or null if invalid
 * @pure
 */
export function convertToAuthCredentials(raw: Record<string, unknown>): AuthCredentials | null {
  const result = extractAuthCredentials(raw)
  return result.ok ? result.value : null
}
