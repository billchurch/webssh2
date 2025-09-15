import crypto from 'node:crypto'

export function generateSecureSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}
