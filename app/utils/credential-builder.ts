// app/utils/credential-builder.ts
// Shared credential building utilities

import type { Credentials } from '../validation/credentials.js'

/**
 * Build standardized credentials from raw session data
 * @param rawCreds - Raw credential data from session
 * @returns Standardized Credentials object
 */
export function buildCredentials(rawCreds: Record<string, unknown>): Credentials {
  const result: Credentials = {
    host: typeof rawCreds['host'] === 'string' ? rawCreds['host'] : '',
    port: typeof rawCreds['port'] === 'number' ? rawCreds['port'] : 22,
    username: typeof rawCreds['username'] === 'string' ? rawCreds['username'] : '',
    password: typeof rawCreds['password'] === 'string' ? rawCreds['password'] : '',
  }
  
  // Conditionally add optional fields
  if (rawCreds['term'] != null && rawCreds['term'] !== '') {
    const term = rawCreds['term']
    if (typeof term === 'string' || typeof term === 'number') {
      result.term = String(term)
    }
  }
  
  if (rawCreds['privateKey'] != null && rawCreds['privateKey'] !== '') {
    const key = rawCreds['privateKey']
    if (typeof key === 'string') {
      result.privateKey = key
    }
  }
  
  if (rawCreds['passphrase'] != null && rawCreds['passphrase'] !== '') {
    const pass = rawCreds['passphrase']
    if (typeof pass === 'string') {
      result.passphrase = pass
    }
  }
  
  return result
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