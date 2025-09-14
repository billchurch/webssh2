// app/utils/credential-builder.ts
// Shared credential building utilities

import type { Credentials } from '../validation/credentials.js'

/**
 * Extract and validate the host field from raw credentials
 * @param rawCreds - Raw credential data
 * @returns Validated host value
 */
function extractHost(rawCreds: Record<string, unknown>): string {
  const value = rawCreds['host']
  return typeof value === 'string' ? value : ''
}

/**
 * Extract and validate the username field from raw credentials
 * @param rawCreds - Raw credential data
 * @returns Validated username value
 */
function extractUsername(rawCreds: Record<string, unknown>): string {
  const value = rawCreds['username']
  return typeof value === 'string' ? value : ''
}

/**
 * Extract and validate the password field from raw credentials
 * @param rawCreds - Raw credential data
 * @returns Validated password value
 */
function extractPassword(rawCreds: Record<string, unknown>): string {
  const value = rawCreds['password']
  return typeof value === 'string' ? value : ''
}

/**
 * Extract and validate the port field from raw credentials
 * @param rawCreds - Raw credential data
 * @returns Validated port value
 */
function extractPort(rawCreds: Record<string, unknown>): number {
  const value = rawCreds['port']
  return typeof value === 'number' ? value : 22
}

/**
 * Extract and validate the term field from raw credentials
 * @param rawCreds - Raw credential data
 * @returns Validated term value or undefined
 */
function extractTerm(rawCreds: Record<string, unknown>): string | undefined {
  const value = rawCreds['term']
  if (value == null || value === '') {
    return undefined
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return undefined
}

/**
 * Extract and validate the privateKey field from raw credentials
 * @param rawCreds - Raw credential data
 * @returns Validated privateKey value or undefined
 */
function extractPrivateKey(rawCreds: Record<string, unknown>): string | undefined {
  const value = rawCreds['privateKey']
  if (value == null || value === '') {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  return undefined
}

/**
 * Extract and validate the passphrase field from raw credentials
 * @param rawCreds - Raw credential data
 * @returns Validated passphrase value or undefined
 */
function extractPassphrase(rawCreds: Record<string, unknown>): string | undefined {
  const value = rawCreds['passphrase']
  if (value == null || value === '') {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  return undefined
}

/**
 * Build the base required credentials
 * @param rawCreds - Raw credential data
 * @returns Base credentials with required fields
 */
function buildBaseCredentials(rawCreds: Record<string, unknown>): Credentials {
  return {
    host: extractHost(rawCreds),
    port: extractPort(rawCreds),
    username: extractUsername(rawCreds),
    password: extractPassword(rawCreds),
  }
}

/**
 * Add optional fields to credentials
 * @param credentials - Base credentials object
 * @param rawCreds - Raw credential data
 * @returns Credentials with optional fields added
 */
function addOptionalFields(
  credentials: Credentials,
  rawCreds: Record<string, unknown>
): Credentials {
  const result = { ...credentials }
  
  const term = extractTerm(rawCreds)
  if (term !== undefined) {
    result.term = term
  }
  
  const privateKey = extractPrivateKey(rawCreds)
  if (privateKey !== undefined) {
    result.privateKey = privateKey
  }
  
  const passphrase = extractPassphrase(rawCreds)
  if (passphrase !== undefined) {
    result.passphrase = passphrase
  }
  
  return result
}

/**
 * Build standardized credentials from raw session data
 * @param rawCreds - Raw credential data from session
 * @returns Standardized Credentials object
 */
export function buildCredentials(rawCreds: Record<string, unknown>): Credentials {
  const baseCredentials = buildBaseCredentials(rawCreds)
  return addOptionalFields(baseCredentials, rawCreds)
}

/**
 * Extract credentials from session data
 * @param session - Session object containing credentials
 * @returns Credentials or null if not found
 */
export function extractSessionCredentials(
  session: { sshCredentials?: Record<string, unknown> } | undefined
): Credentials | null {
  if (session?.sshCredentials == null) {
    return null
  }
  
  return buildCredentials(session.sshCredentials)
}

/**
 * Validate that required credential fields are present
 * @param creds - Credentials to validate
 * @returns True if credentials have required fields
 */
export function hasRequiredCredentials(creds: Credentials | null): boolean {
  if (creds == null) {
    return false
  }
  
  return (
    creds.host !== '' &&
    creds.username !== '' &&
    (creds.password !== '' || creds.privateKey != null)
  )
}