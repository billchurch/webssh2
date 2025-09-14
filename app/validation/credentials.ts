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
export function validateCredentialFormat(creds: unknown): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (creds === null || creds === undefined || typeof creds !== 'object') {
    return { valid: false, errors: ['Credentials must be an object'] }
  }

  const c = creds as Record<string, unknown>

  // Check username
  if (c['username'] === null || c['username'] === undefined || c['username'] === '' || typeof c['username'] !== 'string') {
    errors.push('Username is required and must be a string')
  } else if ((c['username']).length === 0) {
    errors.push('Username cannot be empty')
  }

  // Check host
  if (c['host'] === null || c['host'] === undefined || c['host'] === '' || typeof c['host'] !== 'string') {
    errors.push('Host is required and must be a string')
  } else if ((c['host']).length === 0) {
    errors.push('Host cannot be empty')
  }

  // Check port
  if (c['port'] !== undefined) {
    const port = Number(c['port'])
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('Port must be a number between 1 and 65535')
    }
  }

  // Check authentication method
  const hasPassword = c['password'] !== null && c['password'] !== undefined && c['password'] !== '' && typeof c['password'] === 'string'
  const hasPrivateKey = c['privateKey'] !== null && c['privateKey'] !== undefined && c['privateKey'] !== '' && typeof c['privateKey'] === 'string'

  if (!hasPassword && !hasPrivateKey) {
    errors.push('Either password or privateKey is required')
  }

  // Check passphrase if present
  if ('passphrase' in c && c['passphrase'] !== undefined && typeof c['passphrase'] !== 'string') {
    errors.push('Passphrase must be a string if provided')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
