// app/validation/ssh.ts
// Pure validation functions for SSH-related inputs

import validator from 'validator'
import { DEFAULTS } from '../constants/index.js'

/**
 * Validates and sanitizes a hostname or IP address
 * @param host - The host string to validate
 * @returns Validated host string
 * @pure
 */
export function validateHost(host: string): string {
  if (validator.isIP(host)) {
    return host
  }
  return validator.escape(host)
}

/**
 * Validates a port number
 * @param portInput - Port as number
 * @returns Valid port number or default
 * @pure
 */
export function validatePort(portInput?: number): number {
  if (portInput != null && portInput >= 1 && portInput <= 65535) {
    return portInput
  }
  return DEFAULTS.SSH_PORT
}

/**
 * Validates SSH terminal type
 * @param term - Terminal type string
 * @returns Validated term or null if invalid
 * @pure
 */
export function validateTerm(term?: string): string | null {
  if (term == null || term === '') {
    return null
  }
  const isValid =
    validator.isLength(term, { min: 1, max: 30 }) && validator.matches(term, /^[a-zA-Z0-9.-]+$/)
  return isValid ? term : null
}

/**
 * Validates SSH private key format
 * @param key - Private key string
 * @returns true if valid private key format
 * @pure
 */
export function validatePrivateKey(key: string): boolean {
  if (key === '' || typeof key !== 'string') {
    return false
  }
  const trimmedKey = key.trim()
  const keyPatterns = [
    /^-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*-----END OPENSSH PRIVATE KEY-----$/,
    /^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*-----END (?:RSA )?PRIVATE KEY-----$/,
    /^-----BEGIN EC PRIVATE KEY-----[\s\S]*-----END EC PRIVATE KEY-----$/,
    /^-----BEGIN DSA PRIVATE KEY-----[\s\S]*-----END DSA PRIVATE KEY-----$/,
    /^-----BEGIN PRIVATE KEY-----[\s\S]*-----END PRIVATE KEY-----$/,
    /^-----BEGIN ENCRYPTED PRIVATE KEY-----[\s\S]*-----END ENCRYPTED PRIVATE KEY-----$/,
  ]
  return keyPatterns.some((pattern) => pattern.test(trimmedKey))
}

/**
 * Checks if a private key is encrypted
 * @param key - Private key string
 * @returns true if key appears to be encrypted
 * @pure
 */
export function isEncryptedKey(key: string): boolean {
  if (key === '' || typeof key !== 'string') {
    return false
  }
  return (
    key.includes('Proc-Type: 4,ENCRYPTED') ||
    key.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----') ||
    (key.includes('-----BEGIN OPENSSH PRIVATE KEY-----') &&
      (key.includes('bcrypt') || key.includes('aes') || key.includes('3des')))
  )
}
