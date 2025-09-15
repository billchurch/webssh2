// app/validation/session.ts
// Pure validation functions for session and connection management

export interface SessionCredentials {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  term?: string
}

/**
 * Checks if credentials object has all required session fields
 * @param creds - Credentials object to validate
 * @returns true if all required fields are present and non-empty
 * @pure
 */
export function hasCompleteSessionCredentials(creds: Record<string, unknown>): boolean {
  return Boolean(
    creds['host'] != null &&
    creds['host'] !== '' &&
    creds['port'] != null &&
    creds['username'] != null &&
    creds['username'] !== '' &&
    (
      (creds['password'] != null && creds['password'] !== '') ||
      (creds['privateKey'] != null && creds['privateKey'] !== '')
    )
  )
}

/**
 * Classifies if an error is a network/connectivity error
 * @param error - Error object to classify
 * @returns true if error is network-related
 * @pure
 */
export function isNetworkError(error: Error & { code?: string }): boolean {
  const networkErrorCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ENETUNREACH']
  
  if (error.code != null && networkErrorCodes.includes(error.code)) {
    return true
  }
  
  const networkErrorPatterns = ['ECONNREFUSED', 'ENOTFOUND', 'timeout']
  return networkErrorPatterns.some(pattern => error.message.includes(pattern))
}

/**
 * Extracts session credentials from a credentials object
 * @param creds - Raw credentials object
 * @returns SessionCredentials object or null if invalid
 * @pure
 */
export function extractSessionCredentials(creds: Record<string, unknown>): SessionCredentials | null {
  if (!hasCompleteSessionCredentials(creds)) {
    return null
  }
  
  const sessionCreds: SessionCredentials = {
    host: creds['host'] as string,
    port: creds['port'] as number,
    username: creds['username'] as string,
  }
  
  if (creds['password'] != null && creds['password'] !== '') {
    sessionCreds.password = creds['password'] as string
  }
  
  if (creds['privateKey'] != null && creds['privateKey'] !== '') {
    sessionCreds.privateKey = creds['privateKey'] as string
  }
  
  if (creds['passphrase'] != null && creds['passphrase'] !== '') {
    sessionCreds.passphrase = creds['passphrase'] as string
  }
  
  if (creds['term'] != null && creds['term'] !== '') {
    sessionCreds.term = creds['term'] as string
  }
  
  return sessionCreds
}

/**
 * Validates if dimensions are valid integers
 * @param value - Value to check
 * @returns true if value is a valid positive integer
 * @pure
 */
export function isValidDimension(value: unknown): boolean {
  if (value == null) {
    return false
  }
  const num = Number(value)
  return !isNaN(num) && num > 0 && Number.isInteger(num)
}