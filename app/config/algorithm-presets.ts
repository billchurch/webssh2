// app/config/algorithm-presets.ts
// Pure data module for SSH algorithm presets

/**
 * SSH algorithm configuration structure
 * @pure
 */
export interface Algorithms {
  cipher: string[]
  kex: string[]
  hmac: string[]
  compress: string[]
  serverHostKey: string[]
}

/**
 * Predefined SSH algorithm presets for different security profiles
 * @pure
 */
export const ALGORITHM_PRESETS: Record<string, Algorithms> = {
  modern: {
    cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes128-ctr'],
    kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
    hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
    compress: ['none', 'zlib@openssh.com'],
    serverHostKey: ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa'],
  },
  legacy: {
    cipher: ['aes256-cbc', 'aes192-cbc', 'aes128-cbc', '3des-cbc'],
    kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'],
    hmac: ['hmac-sha1', 'hmac-md5'],
    compress: ['none', 'zlib'],
    serverHostKey: ['ssh-rsa', 'ssh-dss'],
  },
  strict: {
    cipher: ['aes256-gcm@openssh.com'],
    kex: ['ecdh-sha2-nistp256'],
    hmac: ['hmac-sha2-256'],
    compress: ['none'],
    serverHostKey: ['ecdsa-sha2-nistp256'],
  },
}

/**
 * Get algorithm preset by name
 * @param presetName - Name of the preset (modern, legacy, strict)
 * @returns Algorithm configuration or undefined if not found
 * @pure
 */
export function getAlgorithmPreset(presetName: string): Algorithms | undefined {
  return ALGORITHM_PRESETS[presetName.toLowerCase()]
}

/**
 * Get all available preset names
 * @returns Array of preset names
 * @pure
 */
export function getPresetNames(): string[] {
  return Object.keys(ALGORITHM_PRESETS)
}

/**
 * Validate if a preset name exists
 * @param presetName - Name to validate
 * @returns true if preset exists
 * @pure
 */
export function isValidPreset(presetName: string): boolean {
  return presetName.toLowerCase() in ALGORITHM_PRESETS
}