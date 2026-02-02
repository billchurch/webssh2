// tests/unit/services/ssh/algorithm-test-fixtures.ts
// Shared test fixtures for SSH algorithm tests to reduce code duplication

import { createEmptyAlgorithmSet, type AlgorithmSet } from '../../../../app/services/ssh/algorithm-capture.js'

/**
 * Creates a typical modern SSH client algorithm set
 * Includes modern algorithms with some legacy fallbacks
 */
export const createClientSet = (): AlgorithmSet => ({
  kex: ['curve25519-sha256', 'ecdh-sha2-nistp256', 'diffie-hellman-group14-sha1'],
  serverHostKey: ['ssh-ed25519', 'rsa-sha2-512', 'ssh-rsa'],
  cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr'],
  mac: ['hmac-sha2-256-etm@openssh.com', 'hmac-sha2-256', 'hmac-sha1'],
  compress: ['none', 'zlib@openssh.com']
})

/**
 * Creates a legacy SSH server algorithm set
 * Represents older servers with only legacy algorithm support
 */
export const createLegacyServerSet = (): AlgorithmSet => ({
  kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'],
  serverHostKey: ['ssh-rsa', 'ssh-dss'],
  cipher: ['aes128-cbc', '3des-cbc', 'aes256-cbc'],
  mac: ['hmac-sha1', 'hmac-md5'],
  compress: ['none']
})

/**
 * Creates a modern SSH server algorithm set
 * Represents servers with current best-practice algorithm support
 */
export const createModernServerSet = (): AlgorithmSet => ({
  kex: ['curve25519-sha256', 'ecdh-sha2-nistp256'],
  serverHostKey: ['ssh-ed25519', 'ecdsa-sha2-nistp256'],
  cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com'],
  mac: ['hmac-sha2-256-etm@openssh.com', 'hmac-sha2-256'],
  compress: ['none', 'zlib@openssh.com']
})

/**
 * Helper to create an AlgorithmSet with only a single category populated
 * Useful for testing category-specific behavior
 */
export const createSetWithCategory = (
  category: keyof AlgorithmSet,
  algorithms: string[]
): AlgorithmSet => ({
  ...createEmptyAlgorithmSet(),
  [category]: algorithms
})

// Re-export for convenience
export { createEmptyAlgorithmSet, type AlgorithmSet }
