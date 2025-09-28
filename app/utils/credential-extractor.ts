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
 * Authentication method type
 */
export type AuthMethod = 'password' | 'privateKey' | 'both' | 'none'

/**
 * Credential validation error
 */
export class CredentialError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'CredentialError'
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
export function extractAuthMethod(raw: Record<string, unknown>): AuthMethod {
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
  // Validate required fields first
  const requiredResult = validateRequiredFields(raw)
  if (!requiredResult.ok) {
    return requiredResult
  }

  const { username, host, port } = requiredResult.value

  // Check authentication method
  const authMethod = extractAuthMethod(raw)
  if (authMethod === 'none') {
    return err(new CredentialError('Either password or privateKey is required for authentication'))
  }

  // Build base credentials
  const credentials: AuthCredentials = {
    username,
    host,
    port
  }

  // Add authentication fields
  const password = raw['password']
  if (typeof password === 'string' && password !== '') {
    credentials.password = password
  }

  const privateKey = raw['privateKey']
  if (typeof privateKey === 'string' && privateKey !== '') {
    credentials.privateKey = privateKey
  }

  // Add passphrase if present (only valid with privateKey)
  const passphrase = raw['passphrase']
  if (typeof passphrase === 'string' && passphrase !== '' && credentials.privateKey !== undefined) {
    credentials.passphrase = passphrase
  }

  // Add terminal settings
  const terminalSettings = extractOptionalTerminalSettings(raw)
  if (terminalSettings.term !== undefined) {
    credentials.term = terminalSettings.term
  }
  if (terminalSettings.cols !== undefined) {
    credentials.cols = terminalSettings.cols
  }
  if (terminalSettings.rows !== undefined) {
    credentials.rows = terminalSettings.rows
  }

  return ok(credentials)
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