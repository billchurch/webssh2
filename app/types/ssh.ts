// app/types/ssh.ts
// Type-safe SSH domain models

import type {
  SshHost,
  SshPort,
  Username,
  Password,
  PrivateKey,
  TerminalType,
  SessionId,
  EnvVarName,
  EnvVarValue,
} from './branded.js'

import type { Result } from './result.js'

/**
 * SSH authentication method
 */
export enum SshAuthMethod {
  Password = 'password',
  PublicKey = 'publickey',
  KeyboardInteractive = 'keyboard-interactive',
  None = 'none',
}

/**
 * SSH connection state
 */
export enum SshConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Authenticated = 'authenticated',
  Ready = 'ready',
  Error = 'error',
  Closed = 'closed',
}

/**
 * SSH error types for proper error handling
 */
export enum SshErrorType {
  Authentication = 'auth',
  Network = 'network',
  Timeout = 'timeout',
  Protocol = 'protocol',
  Permission = 'permission',
  Unknown = 'unknown',
}

/**
 * Validated SSH credentials
 */
export interface SshCredentials {
  readonly host: SshHost
  readonly port: SshPort
  readonly username: Username
  readonly password?: Password
  readonly privateKey?: PrivateKey
  readonly passphrase?: string
  readonly authMethod?: SshAuthMethod
}

/**
 * SSH terminal options
 */
export interface SshTerminalOptions {
  readonly term?: TerminalType | null
  readonly cols: number
  readonly rows: number
  readonly width?: number
  readonly height?: number
}

/**
 * SSH environment variables
 */
export type SshEnvironment = ReadonlyMap<EnvVarName, EnvVarValue>

/**
 * SSH session configuration
 */
export interface SshSessionConfig {
  readonly sessionId: SessionId
  readonly credentials: SshCredentials
  readonly terminal?: SshTerminalOptions
  readonly environment?: SshEnvironment
  readonly readyTimeout?: number
  readonly keepaliveInterval?: number
  readonly keepaliveCountMax?: number
}

/**
 * SSH connection info
 */
export interface SshConnectionInfo {
  readonly sessionId: SessionId
  readonly state: SshConnectionState
  readonly connectedAt?: Date
  readonly authenticatedAt?: Date
  readonly lastActivity?: Date
  readonly bytesReceived: number
  readonly bytesSent: number
}

/**
 * SSH error info
 */
export interface SshErrorInfo {
  readonly type: SshErrorType
  readonly message: string
  readonly code?: string
  readonly level?: string
  readonly timestamp: Date
}

/**
 * SSH algorithm configuration
 */
export interface SshAlgorithms {
  readonly kex?: readonly string[]
  readonly cipher?: readonly string[]
  readonly hmac?: readonly string[]
  readonly compress?: readonly string[]
  readonly serverHostKey?: readonly string[]
}

/**
 * Result type for SSH operations
 */
export type SshResult<T> = Result<T, SshErrorInfo>

/**
 * SSH command execution options
 */
export interface SshExecOptions {
  readonly command: string
  readonly pty?: SshTerminalOptions
  readonly environment?: SshEnvironment
  readonly timeout?: number
}

/**
 * SSH command result
 */
export interface SshExecResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
  readonly signal: string | null
}

/**
 * SSH file transfer options
 */
export interface SshFileTransferOptions {
  readonly source: string
  readonly destination: string
  readonly mode?: number
  readonly recursive?: boolean
}

/**
 * SSH tunnel options
 */
export interface SshTunnelOptions {
  readonly localHost?: string
  readonly localPort: number
  readonly remoteHost: string
  readonly remotePort: number
}

/**
 * WebSocket to SSH event mapping
 */
export interface SshEventMapping {
  readonly connect: SshSessionConfig
  readonly disconnect: { sessionId: SessionId; reason?: string }
  readonly resize: SshTerminalOptions & { sessionId: SessionId }
  readonly data: { sessionId: SessionId; data: Buffer | string }
  readonly error: { sessionId: SessionId; error: SshErrorInfo }
  readonly ready: { sessionId: SessionId }
  readonly close: { sessionId: SessionId; code?: number; reason?: string }
}

/**
 * SSH session statistics
 */
export interface SshSessionStats {
  readonly sessionId: SessionId
  readonly duration: number // milliseconds
  readonly commandsExecuted: number
  readonly dataTransferred: {
    readonly sent: number
    readonly received: number
  }
  readonly errors: readonly SshErrorInfo[]
}

/**
 * Type-safe SSH event emitter interface
 */
export interface SshEventEmitter {
  on<K extends keyof SshEventMapping>(
    event: K,
    listener: (data: SshEventMapping[K]) => void
  ): this

  emit<K extends keyof SshEventMapping>(
    event: K,
    data: SshEventMapping[K]
  ): boolean

  off<K extends keyof SshEventMapping>(
    event: K,
    listener: (data: SshEventMapping[K]) => void
  ): this
}

/**
 * SSH connection options builder
 */
export interface SshConnectionBuilder {
  withHost(host: SshHost): this
  withPort(port: SshPort): this
  withUsername(username: Username): this
  withPassword(password: Password): this
  withPrivateKey(key: PrivateKey, passphrase?: string): this
  withTerminal(options: SshTerminalOptions): this
  withEnvironment(env: SshEnvironment): this
  withTimeout(timeout: number): this
  withKeepalive(interval: number, countMax: number): this
  withAlgorithms(algorithms: SshAlgorithms): this
  build(): Result<SshSessionConfig, Error>
}

/**
 * SSH validation rules
 */
export interface SshValidationRules {
  readonly allowedHosts?: readonly SshHost[]
  readonly blockedHosts?: readonly SshHost[]
  readonly allowedPorts?: readonly SshPort[]
  readonly minPasswordLength?: number
  readonly maxPasswordLength?: number
  readonly allowedAuthMethods?: readonly SshAuthMethod[]
  readonly maxSessionDuration?: number
  readonly maxIdleTime?: number
  readonly requiredEnvironmentVars?: readonly EnvVarName[]
}

/**
 * Validate SSH credentials against rules
 */
export type ValidateSshCredentials = (
  credentials: SshCredentials,
  rules: SshValidationRules
) => Result<SshCredentials, SshErrorInfo>

/**
 * SSH reconnection policy
 */
export interface SshReconnectionPolicy {
  readonly maxAttempts: number
  readonly initialDelay: number // milliseconds
  readonly maxDelay: number // milliseconds
  readonly backoffMultiplier: number
  readonly shouldReconnect: (error: SshErrorInfo) => boolean
}

/**
 * SSH session lifecycle hooks
 */
export interface SshSessionLifecycle {
  readonly beforeConnect?: (config: SshSessionConfig) => Promise<void>
  readonly afterConnect?: (info: SshConnectionInfo) => Promise<void>
  readonly beforeAuth?: (credentials: SshCredentials) => Promise<void>
  readonly afterAuth?: (info: SshConnectionInfo) => Promise<void>
  readonly beforeDisconnect?: (sessionId: SessionId) => Promise<void>
  readonly afterDisconnect?: (stats: SshSessionStats) => Promise<void>
  readonly onError?: (error: SshErrorInfo) => Promise<void>
}