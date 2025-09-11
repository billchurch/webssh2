// server
// app/crypto-utils.js
// @ts-check

import crypto from 'crypto'
/**
 * Generates a secure random session secret
 * @returns {string} A random 32-byte hex string
 */
export function generateSecureSecret() {
  return crypto.randomBytes(32).toString('hex')
}
