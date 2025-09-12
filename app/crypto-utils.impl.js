// Flip helper: runtime implementation shim for crypto-utils
// Implement directly to avoid top-level await during dev.
import crypto from 'node:crypto'

export function generateSecureSecret() {
  return crypto.randomBytes(32).toString('hex')
}
