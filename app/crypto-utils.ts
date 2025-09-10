// server
// app/crypto-utils.ts

import crypto from 'crypto';

/**
 * Generates a secure random session secret
 * @returns A random 32-byte hex string
 */
export function generateSecureSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}