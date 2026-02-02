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

/**
 * Creates a modern client set with NO overlap with legacy servers
 * Used for testing complete mismatch scenarios
 */
export const createModernOnlyClientSet = (): AlgorithmSet => ({
  kex: ['curve25519-sha256'],
  serverHostKey: ['ssh-ed25519'],
  cipher: ['aes256-gcm@openssh.com'],
  mac: ['hmac-sha2-256'],
  compress: ['none']
})

/**
 * Creates a minimal legacy server set
 * Used for testing mismatch scenarios against modern clients
 */
export const createMinimalLegacyServerSet = (): AlgorithmSet => ({
  kex: ['diffie-hellman-group14-sha1'],
  serverHostKey: ['ssh-rsa'],
  cipher: ['aes128-cbc'],
  mac: ['hmac-sha1'],
  compress: ['none']
})

/**
 * Creates a strict-compatible server set
 * Contains only algorithms available in the 'strict' preset
 */
export const createStrictServerSet = (): AlgorithmSet => ({
  kex: ['ecdh-sha2-nistp256', 'curve25519-sha256'],
  serverHostKey: ['ecdsa-sha2-nistp256', 'ssh-ed25519'],
  cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com'],
  mac: ['hmac-sha2-256', 'hmac-sha2-512'],
  compress: ['none']
})

/**
 * Creates an unknown/incompatible server set
 * Contains algorithms that match no known presets
 */
export const createUnknownServerSet = (): AlgorithmSet => ({
  kex: ['unknown-kex-algorithm'],
  serverHostKey: ['unknown-hostkey'],
  cipher: ['unknown-cipher'],
  mac: ['unknown-mac'],
  compress: ['none']
})

/**
 * Creates a modern-compatible server set
 * Contains algorithms that are in modern preset but NOT in strict
 */
export const createModernCompatibleServerSet = (): AlgorithmSet => ({
  kex: ['ecdh-sha2-nistp384'],
  serverHostKey: ['ecdsa-sha2-nistp384'],
  cipher: ['aes128-ctr'],
  mac: ['hmac-sha2-512'],
  compress: ['none']
})

/**
 * Creates a client set with legacy fallbacks that can connect to legacy servers
 * Used for testing compatible client-server scenarios
 */
export const createCompatibleClientSet = (): AlgorithmSet => ({
  kex: ['curve25519-sha256', 'ecdh-sha2-nistp256', 'diffie-hellman-group14-sha1'],
  serverHostKey: ['ssh-ed25519', 'ssh-rsa'],
  cipher: ['aes256-gcm@openssh.com', 'aes128-cbc'],
  mac: ['hmac-sha2-256', 'hmac-sha1'],
  compress: ['none']
})

/**
 * Creates a modern client set for integration tests
 * Contains typical modern SSH client algorithms (same as modern server)
 */
export const createModernClientSet = (): AlgorithmSet => createModernServerSet()

// Re-export for convenience
export { createEmptyAlgorithmSet, type AlgorithmSet } from '../../../../app/services/ssh/algorithm-capture.js'
