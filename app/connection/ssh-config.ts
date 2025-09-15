// app/connection/ssh-config.ts
// Pure functions for building SSH configuration

import type { Credentials } from '../validation/credentials.js'
import type { Config } from '../types/config.js'
import { validatePrivateKey, isEncryptedKey } from '../validation/ssh.js'

export interface SSHConfig {
  host: string
  port: number
  username?: string
  password?: string
  privateKey?: string
  passphrase?: string
  tryKeyboard: boolean
  algorithms?: unknown
  readyTimeout?: number
  keepaliveInterval?: number
  keepaliveCountMax?: number
}

/**
 * Build SSH configuration from credentials
 * @param creds - User credentials
 * @param config - Application configuration
 * @param tryKeyboard - Whether to try keyboard-interactive auth
 * @returns SSH configuration object
 * @pure
 */
export function buildSSHConfig(
  creds: Partial<Credentials>,
  config: Config,
  tryKeyboard = true
): SSHConfig {
  const sshConfig: SSHConfig = {
    host: creds.host ?? '',
    port: creds.port ?? 22,
    tryKeyboard,
    algorithms: config.ssh.algorithms as unknown,
    readyTimeout: config.ssh.readyTimeout,
    keepaliveInterval: config.ssh.keepaliveInterval,
    keepaliveCountMax: config.ssh.keepaliveCountMax,
  }
  
  if (creds.username != null && creds.username !== '') {
    sshConfig.username = creds.username
  }
  
  // Add private key if valid
  if (creds.privateKey != null && creds.privateKey !== '' && validatePrivateKey(creds.privateKey)) {
    sshConfig.privateKey = creds.privateKey
    
    // Add passphrase if key is encrypted
    if (isEncryptedKey(creds.privateKey) && creds.passphrase != null && creds.passphrase !== '') {
      sshConfig.passphrase = creds.passphrase
    }
  }
  
  // Add password if provided
  if (creds.password != null && creds.password !== '') {
    sshConfig.password = creds.password
  }
  
  return sshConfig
}

/**
 * Merge partial SSH configurations
 * @param base - Base configuration
 * @param overrides - Configuration overrides
 * @returns Merged SSH configuration
 * @pure
 */
export function mergeSSHConfig(
  base: SSHConfig,
  overrides: Partial<SSHConfig>
): SSHConfig {
  return {
    ...base,
    ...overrides,
    algorithms: overrides.algorithms ?? base.algorithms,
  }
}