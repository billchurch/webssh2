// app/ssh/connection-factory.ts
// Pure functions for SSH connection configuration

import type { ConnectConfig } from 'ssh2'
import type { Config } from '../types/config.js'
import type { Result } from '../types/result.js'
import { buildSshConfig, type SshCredentials, type PtyOptions } from './config-builder.js'
import { filterEnvironmentVariables } from '../connection/environment-filter.js'

export interface ConnectionConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  readyTimeout?: number
  keepaliveInterval?: number
  keepaliveCountMax?: number
  algorithms?: Record<string, unknown>
  allowedSubnets?: string[] | undefined
}

export interface ShellOptions {
  pty: PtyOptions
  env?: Record<string, string> | undefined
}

export interface ExecOptions {
  command: string
  pty?: PtyOptions | undefined
  env?: Record<string, string> | undefined
}

export interface ConnectionState {
  id: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  host: string
  port: number
  username: string
  connectedAt?: Date
  lastActivity?: Date
  errorMessage?: string
}

/**
 * Create SSH connection configuration from credentials and app config
 * Pure function - no side effects
 */
export const createConnectionConfig = (
  credentials: SshCredentials,
  appConfig: Config
): ConnectionConfig => {
  const sshConfig = buildSshConfig(
    credentials,
    appConfig,
    true,
    () => { /* No-op logger for pure function */ }
  )

  const config: ConnectionConfig = {
    host: String(sshConfig.host),
    port: Number(sshConfig.port),
    username: String(sshConfig.username)
  }
  
  if (appConfig.ssh.allowedSubnets != null) {
    config.allowedSubnets = appConfig.ssh.allowedSubnets
  }

  const { password, privateKey, passphrase } = sshConfig
  
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (password != null) {
    config.password = String(password)
  }
  if (privateKey != null) {
    config.privateKey = String(privateKey)
  }
  if (passphrase != null) {
    config.passphrase = String(passphrase)
  }
  
  // These are always defined from buildSshConfig
  config.readyTimeout = Number(sshConfig.readyTimeout)
  config.keepaliveInterval = Number(sshConfig.keepaliveInterval)
  config.keepaliveCountMax = Number(sshConfig.keepaliveCountMax)
  
  if (sshConfig.algorithms != null) {
    config.algorithms = sshConfig.algorithms as Record<string, unknown>
  }

  return config
}

/**
 * Prepare shell options from terminal config and environment
 * Pure function - no side effects
 */
export const prepareShellOptions = (
  terminal: PtyOptions,
  env: Record<string, string> = {},
  allowlist?: string[]
): ShellOptions => {
  const filteredEnv = filterEnvironmentVariables(env, allowlist)
  
  const options: ShellOptions = {
    pty: terminal
  }
  
  if (Object.keys(filteredEnv).length > 0) {
    options.env = filteredEnv
  }
  
  return options
}

/**
 * Prepare exec command options
 * Pure function - no side effects
 */
export const prepareExecOptions = (
  command: string,
  pty?: PtyOptions,
  env?: Record<string, string>,
  allowlist?: string[]
): ExecOptions => {
  const filteredEnv = env != null 
    ? filterEnvironmentVariables(env, allowlist)
    : undefined

  const options: ExecOptions = {
    command
  }
  
  if (pty != null) {
    options.pty = pty
  }
  
  if (filteredEnv != null && Object.keys(filteredEnv).length > 0) {
    options.env = filteredEnv
  }
  
  return options
}

/**
 * Validate connection configuration
 * Pure function - returns Result type
 */
export const validateConnectionConfig = (
  config: ConnectionConfig
): Result<ConnectionConfig> => {
  // Validate host
  if (config.host === '') {
    return {
      ok: false,
      error: new Error('Host is required')
    }
  }

  // Validate port
  if (config.port <= 0 || config.port > 65535) {
    return {
      ok: false,
      error: new Error(`Invalid port: ${config.port}`)
    }
  }

  // Validate username
  if (config.username === '') {
    return {
      ok: false,
      error: new Error('Username is required')
    }
  }

  // Validate authentication method
  const hasPassword = config.password != null && config.password !== ''
  const hasPrivateKey = config.privateKey != null && config.privateKey !== ''
  
  if (hasPassword === false && hasPrivateKey === false) {
    return {
      ok: false,
      error: new Error('Either password or private key is required')
    }
  }

  return {
    ok: true,
    value: config
  }
}

/**
 * Create initial connection state
 * Pure function - no side effects
 */
export const createConnectionState = (
  config: ConnectionConfig,
  id?: string
): ConnectionState => {
  return {
    id: id ?? generateConnectionId(config),
    status: 'disconnected',
    host: config.host,
    port: config.port,
    username: config.username
  }
}

/**
 * Update connection state
 * Pure function - returns new state
 */
export const updateConnectionState = (
  state: ConnectionState,
  update: Partial<ConnectionState>
): ConnectionState => {
  return {
    ...state,
    ...update,
    lastActivity: new Date()
  }
}

/**
 * Process keyboard-interactive authentication
 * Pure function - returns responses
 */
export const processKeyboardInteractive = (
  prompts: Array<{ prompt: string; echo: boolean }>,
  password?: string
): string[] => {
  if (password == null || password === '') {
    return []
  }

  // Most SSH servers asking for password via keyboard-interactive
  // will have 1 prompt for the password
  return prompts.map(() => password)
}

/**
 * Check if a host string is an IP address
 * Pure function - no side effects
 */
const isIpAddress = (host: string): boolean => {
  // eslint-disable-next-line security/detect-unsafe-regex
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  // eslint-disable-next-line security/detect-unsafe-regex
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

  return ipv4Pattern.test(host) || ipv6Pattern.test(host)
}

/**
 * Check if IP matches exact subnet
 * Pure function - no side effects
 */
const matchesExact = (host: string, subnet: string): boolean => {
  return subnet === host
}

/**
 * Check if IP matches CIDR notation subnet
 * Pure function - no side effects
 */
const matchesCidr = (host: string, subnet: string): boolean => {
  if (!subnet.includes('/')) {
    return false
  }

  const [subnetBase] = subnet.split('/')
  if (subnetBase === undefined) {
    return false
  }

  // Basic prefix matching (simplified)
  const lastDot = subnetBase.lastIndexOf('.')
  return lastDot !== -1 && host.startsWith(subnetBase.substring(0, lastDot))
}

/**
 * Check if IP matches wildcard notation subnet
 * Pure function - no side effects
 */
const matchesWildcard = (host: string, subnet: string): boolean => {
  if (!subnet.includes('*')) {
    return false
  }

  const pattern = subnet.replaceAll(/\./g, '\\.').replaceAll(/\*/g, '.*')
  // eslint-disable-next-line security/detect-non-literal-regexp
  const regex = new RegExp(`^${pattern}$`)
  return regex.test(host)
}

/**
 * Check if IP is in any of the allowed subnets
 * Pure function - no side effects
 */
const isIpInSubnets = (host: string, allowedSubnets: string[]): boolean => {
  for (const subnet of allowedSubnets) {
    if (matchesExact(host, subnet)) {
      return true
    }

    if (matchesCidr(host, subnet)) {
      return true
    }

    if (matchesWildcard(host, subnet)) {
      return true
    }
  }

  return false
}

/**
 * Check if connection is allowed based on subnet restrictions
 * Pure function - no side effects
 */
export const isConnectionAllowed = (
  host: string,
  allowedSubnets?: string[]
): Result<boolean> => {
  if (allowedSubnets == null || allowedSubnets.length === 0) {
    return { ok: true, value: true } // No restrictions
  }

  if (!isIpAddress(host)) {
    // Host is a hostname, needs async DNS resolution
    return {
      ok: false,
      error: new Error(`Hostname validation requires DNS resolution: ${host}`)
    }
  }

  const isAllowed = isIpInSubnets(host, allowedSubnets)
  return { ok: true, value: isAllowed }
}

/**
 * Generate unique connection ID
 * Pure function - deterministic based on input
 */
const generateConnectionId = (config: ConnectionConfig): string => {
  const timestamp = Date.now()
  const hash = `${config.host}:${config.port}:${config.username}:${timestamp}`
  return Buffer.from(hash).toString('base64').slice(0, 12)
}

/**
 * Convert to SSH2 connect config format
 * Pure function - no side effects
 */
export const toSsh2Config = (config: ConnectionConfig): Partial<ConnectConfig> => {
  const ssh2Config: Partial<ConnectConfig> = {
    host: config.host,
    port: config.port,
    username: config.username
  }

  if (config.password != null) {
    ssh2Config.password = config.password
  }

  if (config.privateKey != null) {
    ssh2Config.privateKey = config.privateKey
  }

  if (config.passphrase != null) {
    ssh2Config.passphrase = config.passphrase
  }

  if (config.readyTimeout != null) {
    ssh2Config.readyTimeout = config.readyTimeout
  }

  if (config.keepaliveInterval != null) {
    ssh2Config.keepaliveInterval = config.keepaliveInterval
  }

  if (config.keepaliveCountMax != null) {
    ssh2Config.keepaliveCountMax = config.keepaliveCountMax
  }

  if (config.algorithms != null) {
    (ssh2Config as Record<string, unknown>)['algorithms'] = config.algorithms
  }

  return ssh2Config
}