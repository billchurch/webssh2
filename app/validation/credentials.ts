// app/validation/credentials.ts
// Pure validation functions for credentials

export interface Credentials {
  username?: string
  host?: string
  port?: number
  password?: string
  privateKey?: string
  passphrase?: string
  term?: string
  cols?: number
  rows?: number
}

/**
 * Validates if credentials object has required fields
 * @param creds - Credentials to validate
 * @returns true if credentials are valid
 * @pure
 */
export function isValidCredentials(creds: Credentials | undefined): boolean {
  if (creds == null) {
    return false
  }
  
  const hasRequiredFields = Boolean(
    typeof creds.username === 'string' &&
    typeof creds.host === 'string' &&
    typeof creds.port === 'number'
  )

  if (hasRequiredFields === false) {
    return false
  }

  const hasPassword = typeof creds.password === 'string'
  const hasPrivateKey = typeof creds.privateKey === 'string'
  const hasValidPassphrase = !('passphrase' in creds) || typeof creds.passphrase === 'string'

  return (hasPassword || hasPrivateKey) && hasValidPassphrase
}

/**
 * Validates credential format without checking authentication
 * @param creds - Credentials to validate
 * @returns Validation result with specific errors
 * @pure
 */
interface CredentialRecord {
  username?: unknown
  host?: unknown
  port?: unknown
  password?: unknown
  privateKey?: unknown
  passphrase?: unknown
}

function isCredentialRecord(value: unknown): value is CredentialRecord {
  return value !== null && typeof value === 'object'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function validateUsername(record: CredentialRecord, errors: string[]): void {
  if (typeof record.username !== 'string') {
    errors.push('Username is required and must be a string')
    return
  }

  if (record.username.length === 0) {
    errors.push('Username cannot be empty')
  }
}

function validateHost(record: CredentialRecord, errors: string[]): void {
  if (typeof record.host !== 'string') {
    errors.push('Host is required and must be a string')
    return
  }

  if (record.host.length === 0) {
    errors.push('Host cannot be empty')
  }
}

function validatePort(record: CredentialRecord, errors: string[]): void {
  if (record.port === undefined) {
    return
  }

  const portCandidate = typeof record.port === 'string'
    ? Number.parseInt(record.port, 10)
    : record.port

  if (
    typeof portCandidate !== 'number' ||
    Number.isNaN(portCandidate) ||
    portCandidate < 1 ||
    portCandidate > 65535
  ) {
    errors.push('Port must be a number between 1 and 65535')
  }
}

function validateAuthentication(record: CredentialRecord, errors: string[]): void {
  const hasPassword = isNonEmptyString(record.password)
  const hasPrivateKey = isNonEmptyString(record.privateKey)

  if (!hasPassword && !hasPrivateKey) {
    errors.push('Either password or privateKey is required')
  }
}

function validatePassphrase(record: CredentialRecord, errors: string[]): void {
  if (!('passphrase' in record)) {
    return
  }

  if (record.passphrase !== undefined && typeof record.passphrase !== 'string') {
    errors.push('Passphrase must be a string if provided')
  }
}

export function validateCredentialFormat(creds: unknown): {
  valid: boolean
  errors: string[]
} {
  if (!isCredentialRecord(creds)) {
    return { valid: false, errors: ['Credentials must be an object'] }
  }

  const errors: string[] = []
  const record = creds

  validateUsername(record, errors)
  validateHost(record, errors)
  validatePort(record, errors)
  validateAuthentication(record, errors)
  validatePassphrase(record, errors)

  return {
    valid: errors.length === 0,
    errors
  }
}
