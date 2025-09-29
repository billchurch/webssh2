// app/connection/ssh-config.ts
// Pure functions for building SSH configuration

import type { Credentials } from '../validation/credentials.js'
import type { Config } from '../types/config.js'
import { validatePrivateKey, isEncryptedKey } from '../validation/ssh.js'
import { DEFAULTS } from '../constants/index.js'

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
  const baseConfig = createBaseConfig(creds, config, tryKeyboard)

  return {
    ...baseConfig,
    ...buildUsernameSection(creds),
    ...buildPrivateKeySection(creds),
    ...buildPasswordSection(creds)
  }
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

const createBaseConfig = (
  creds: Partial<Credentials>,
  config: Config,
  tryKeyboard: boolean
): SSHConfig => ({
  host: creds.host ?? '',
  port: creds.port ?? DEFAULTS.SSH_PORT,
  tryKeyboard,
  algorithms: config.ssh.algorithms as unknown,
  readyTimeout: config.ssh.readyTimeout,
  keepaliveInterval: config.ssh.keepaliveInterval,
  keepaliveCountMax: config.ssh.keepaliveCountMax,
})

const buildUsernameSection = (creds: Partial<Credentials>): Partial<SSHConfig> => {
  const username = takeFilled(creds.username)
  if (username === undefined) {
    return {}
  }
  return { username }
}

const buildPrivateKeySection = (creds: Partial<Credentials>): Partial<SSHConfig> => {
  const privateKey = takeFilled(creds.privateKey)
  if (privateKey === undefined) {
    return {}
  }
  if (!validatePrivateKey(privateKey)) {
    return {}
  }

  if (isEncryptedKey(privateKey)) {
    const passphrase = takeFilled(creds.passphrase)
    if (passphrase === undefined) {
      return { privateKey }
    }
    return {
      privateKey,
      passphrase
    }
  }

  return { privateKey }
}

const buildPasswordSection = (creds: Partial<Credentials>): Partial<SSHConfig> => {
  const sanitizedPassword = takeFilled(creds.password)
  if (typeof sanitizedPassword !== 'string') {
    return {}
  }
  return { password: sanitizedPassword }
}

const takeFilled = (value: string | null | undefined): string | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }
  if (value.length === 0) {
    return undefined
  }
  return value
}
