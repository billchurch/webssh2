// app/types/config.ts
// Configuration type definitions

import type { Result } from './result.js'
import type { LogLevel } from '../logging/levels.js'
import type { LogEventName } from '../logging/event-catalog.js'

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
  sessionTimeout?: number
  maxHistorySize?: number
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
 * Terminal configuration
 */
export interface TerminalConfig {
  rows?: number
  cols?: number
  term?: string
}

/**
 * Logging controls configuration for runtime sampling and rate limits
 */
export interface LoggingControlsConfig {
  readonly sampling?: LoggingSamplingConfig
  readonly rateLimit?: LoggingRateLimitConfig
}

/**
 * Logging sampling configuration
 */
export interface LoggingSamplingConfig {
  readonly defaultSampleRate?: number
  readonly rules?: readonly LoggingSamplingRule[]
}

/**
 * Logging sampling rule entry
 */
export interface LoggingSamplingRule {
  readonly target: LoggingEventTarget
  readonly sampleRate: number
}

/**
 * Logging rate limit configuration
 */
export interface LoggingRateLimitConfig {
  readonly rules?: readonly LoggingRateLimitRule[]
}

/**
 * Logging rate limit rule entry
 */
export interface LoggingRateLimitRule {
  readonly target: LoggingEventTarget
  readonly limit: number
  readonly intervalMs: number
  readonly burst?: number
}

/**
 * Supported logging event target identifiers
 */
export type LoggingEventTarget = '*' | LogEventName

export interface LoggingStdoutConfig {
  readonly enabled: boolean
  readonly minimumLevel?: LogLevel
}

export interface LoggingSyslogTlsConfig {
  readonly enabled: boolean
  readonly caFile?: string
  readonly certFile?: string
  readonly keyFile?: string
  readonly rejectUnauthorized?: boolean
}

export interface LoggingSyslogConfig {
  readonly enabled: boolean
  readonly host?: string
  readonly port?: number
  readonly appName?: string
  readonly enterpriseId?: number
  readonly bufferSize?: number
  readonly flushIntervalMs?: number
  readonly includeJson?: boolean
  readonly tls?: LoggingSyslogTlsConfig
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  readonly namespace?: string
  readonly minimumLevel?: LogLevel
  readonly controls?: LoggingControlsConfig
  readonly stdout?: LoggingStdoutConfig
  readonly syslog?: LoggingSyslogConfig
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
  terminal?: TerminalConfig
  logging?: LoggingConfig
  allowedSubnets?: string[]
  safeShutdownDuration?: number
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
