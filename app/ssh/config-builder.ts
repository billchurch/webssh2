// app/ssh/config-builder.ts
// Pure functions for building SSH connection configuration

import type { Config } from '../types/config.js'
import { validatePrivateKey, isEncryptedKey } from '../validation/ssh.js'

/**
 * SSH connection configuration
 */
export interface SshConnectionConfig {
  host: string
  port: number
  username?: string
  password?: string
  privateKey?: string
  passphrase?: string
  tryKeyboard: boolean
  algorithms?: unknown
  readyTimeout: number
  keepaliveInterval: number
  keepaliveCountMax: number
  debug?: (msg: string) => void
}

/**
 * SSH credentials from user input
 */
export interface SshCredentials {
  host?: unknown
  port?: unknown
  username?: unknown
  password?: unknown
  privateKey?: unknown
  passphrase?: unknown
  [key: string]: unknown
}

/**
 * PTY options for shell/exec
 */
export interface PtyOptions {
  term?: string | null
  rows?: number
  cols?: number
  width?: number
  height?: number
}

/**
 * Exec options including PTY and environment
 */
export interface ExecOptions {
  env?: Record<string, string>
  pty?: PtyOptions
}

/**
 * Extract host from credentials
 * Pure function - no side effects
 */
export function extractHost(creds: SshCredentials): string {
  const hostValue = creds.host
  
  if (hostValue == null) {
    return ''
  }
  
  if (typeof hostValue === 'string' || typeof hostValue === 'number') {
    return String(hostValue)
  }
  
  return ''
}

/**
 * Extract port from credentials
 * Pure function - no side effects
 */
export function extractPort(creds: SshCredentials): number {
  const portValue = creds.port
  
  if (portValue == null) {
    return 22
  }
  
  if (typeof portValue === 'number') {
    return portValue
  }
  
  if (typeof portValue === 'string') {
    const parsed = Number.parseInt(portValue, 10)
    return Number.isNaN(parsed) ? 22 : parsed
  }
  
  return 22
}

/**
 * Extract and validate authentication credentials
 * Pure function - no side effects
 */
export function extractAuthCredentials(creds: SshCredentials): {
  username?: string
  password?: string
  privateKey?: string
  passphrase?: string
} {
  const result: {
    username?: string
    password?: string
    privateKey?: string
    passphrase?: string
  } = {}
  
  // Username
  const username = creds.username
  if (typeof username === 'string' && username !== '') {
    result.username = username
  }
  
  // Password
  const password = creds.password
  if (typeof password === 'string' && password !== '') {
    result.password = password
  }
  
  // Private key and passphrase
  const privateKey = creds.privateKey
  if (typeof privateKey === 'string' && privateKey !== '' && validatePrivateKey(privateKey)) {
    result.privateKey = privateKey
    
    // Only include passphrase if key is encrypted
    if (isEncryptedKey(privateKey)) {
      const passphrase = creds.passphrase
      if (typeof passphrase === 'string' && passphrase !== '') {
        result.passphrase = passphrase
      }
    }
  }
  
  return result
}

/**
 * Build SSH connection configuration
 * Pure function - no side effects
 */
export function buildSshConfig(
  creds: SshCredentials,
  config: Config,
  tryKeyboard: boolean,
  debugFn?: (msg: string) => void
): SshConnectionConfig {
  const auth = extractAuthCredentials(creds)
  
  const sshConfig: SshConnectionConfig = {
    host: extractHost(creds),
    port: extractPort(creds),
    tryKeyboard,
    algorithms: config.ssh.algorithms,
    readyTimeout: config.ssh.readyTimeout,
    keepaliveInterval: config.ssh.keepaliveInterval,
    keepaliveCountMax: config.ssh.keepaliveCountMax
  }
  
  // Add optional fields
  if (auth.username != null) {
    sshConfig.username = auth.username
  }
  
  if (auth.password != null) {
    sshConfig.password = auth.password
  }
  
  if (auth.privateKey != null) {
    sshConfig.privateKey = auth.privateKey
  }
  
  if (auth.passphrase != null) {
    sshConfig.passphrase = auth.passphrase
  }
  
  if (debugFn != null) {
    sshConfig.debug = debugFn
  }
  
  return sshConfig
}

/**
 * Create PTY options for shell
 * Pure function - no side effects
 */
export function createPtyOptions(options: PtyOptions): Record<string, unknown> {
  const pty: Record<string, unknown> = {}
  
  if (options.term != null) {
    pty['term'] = options.term
  }
  
  if (options.rows != null) {
    pty['rows'] = options.rows
  }
  
  if (options.cols != null) {
    pty['cols'] = options.cols
  }
  
  if (options.width != null) {
    pty['width'] = options.width
  }
  
  if (options.height != null) {
    pty['height'] = options.height
  }
  
  return pty
}

/**
 * Create exec options with PTY and environment
 * Pure function - no side effects
 */
export function createExecOptions(
  ptyOptions?: PtyOptions,
  envVars?: Record<string, string>
): ExecOptions {
  const options: ExecOptions = {}
  
  if (envVars != null && Object.keys(envVars).length > 0) {
    options.env = envVars
  }
  
  if (ptyOptions != null) {
    options.pty = createPtyOptions(ptyOptions)
  }
  
  return options
}