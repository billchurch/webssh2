// server
// app/crypto-utils.ts

import crypto from 'crypto'

export function generateSecureSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}
