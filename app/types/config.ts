// app/types/config.ts
// Configuration type definitions

import type { LogLevel } from '../logging/levels.js'
import type { LogEventName } from '../logging/event-catalog.js'
import type { AuthMethod } from './branded.js'
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
 * Host key verification server store configuration
 */
export interface HostKeyServerStoreConfig {
  enabled: boolean
  dbPath: string
}

/**
 * Host key verification client store configuration
 */
export interface HostKeyClientStoreConfig {
  enabled: boolean
}

/**
 * Host key verification configuration
 */
export interface HostKeyVerificationConfig {
  enabled: boolean
  mode: 'server' | 'client' | 'hybrid'
  unknownKeyAction: 'prompt' | 'alert' | 'reject'
  serverStore: HostKeyServerStoreConfig
  clientStore: HostKeyClientStoreConfig
}

/**
 * SFTP backend type
 *
 * - 'sftp': Uses the SSH SFTP subsystem (default, requires server support)
 * - 'shell': Uses shell commands (ls, cat) via exec, for BusyBox/dropbear
 */
export type SftpBackend = 'sftp' | 'shell'

/**
 * SFTP configuration
 */
export interface SftpConfig {
  /** Backend for file operations: 'sftp' (default) or 'shell' (BusyBox) */
  backend: SftpBackend
  /** Whether SFTP file transfer is enabled */
  enabled: boolean
  /** Maximum file size in bytes for upload/download */
  maxFileSize: number
  /** Transfer rate limit in bytes per second (0 = unlimited) */
  transferRateLimitBytesPerSec: number
  /** Chunk size for transfers in bytes */
  chunkSize: number
  /** Maximum concurrent transfers per session */
  maxConcurrentTransfers: number
  /** Paths that are allowed for SFTP operations (null = allow all) */
  allowedPaths: string[] | null
  /** File extensions that are blocked from upload */
  blockedExtensions: string[]
  /** Operation timeout in milliseconds */
  timeout: number
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
  allowedAuthMethods: AuthMethod[]
  maxExecOutputBytes?: number
  outputRateLimitBytesPerSec?: number
  socketHighWaterMark?: number
  /** SFTP file transfer configuration */
  sftp?: SftpConfig
  /** Host key verification configuration */
  hostKeyVerification: HostKeyVerificationConfig
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
 * Telnet authentication pattern configuration
 */
export interface TelnetAuthConfig {
  loginPrompt: string
  passwordPrompt: string
  failurePattern: string
  expectTimeout: number
}

/**
 * Telnet protocol configuration
 */
export interface TelnetConfig {
  enabled: boolean
  defaultPort: number
  timeout: number
  term: string
  auth: TelnetAuthConfig
  allowedSubnets: string[]
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
  telnet?: TelnetConfig
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
