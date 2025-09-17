// app/types/config.ts
// Configuration type definitions

import type { Result } from './result.js'

/**
 * SSH algorithms configuration
 */
export interface AlgorithmsConfig {
  cipher: string[]
  compress: string[]
  hmac: string[]
  kex: string[]
  serverHostKey: string[]
}

/**
 * SSH configuration
 */
export interface SSHConfig {
  host: string | null
  port: number
  localAddress?: string
  localPort?: number
  term: string
  readyTimeout: number
  keepaliveInterval: number
  keepaliveCountMax: number
  allowedSubnets?: string[]
  alwaysSendKeyboardInteractivePrompts: boolean
  disableInteractiveAuth: boolean
  algorithms: AlgorithmsConfig
  envAllowlist?: string[]
}

/**
 * Header configuration
 */
export interface HeaderConfig {
  text: string | null
  background: string
}

/**
 * Options configuration
 */
export interface OptionsConfig {
  challengeButton: boolean
  autoLog: boolean
  allowReauth: boolean
  allowReconnect: boolean
  allowReplay: boolean
  replayCRLF?: boolean
}

/**
 * Session configuration
 */
export interface SessionConfig {
  secret: string
  name: string
}

/**
 * SSO configuration
 */
export interface SsoConfig {
  enabled: boolean
  csrfProtection: boolean
  trustedProxies: string[]
  headerMapping: {
    username: string
    password: string
    session: string
  }
}

/**
 * Main configuration interface
 */
export interface Config {
  listen: { ip: string; port: number }
  http: { origins: string[] }
  user: {
    name: string | null
    password: string | null
    privateKey: string | null
    passphrase: string | null
  }
  ssh: SSHConfig
  header: HeaderConfig
  options: OptionsConfig
  session: SessionConfig
  sso: SsoConfig
  getCorsConfig?: () => { origin: string[]; methods: string[]; credentials: boolean }
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  readonly path: string
  readonly message: string
  readonly value?: unknown
  readonly expected?: string
}

/**
 * Configuration validation result
 */
export type ConfigValidationResult = Result<Config, ConfigValidationError[]>
