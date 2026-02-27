/**
 * Service interfaces for dependency injection and composition
 */

import type { SessionId, ConnectionId, UserId } from '../types/branded.js'
import type { Result, SessionState } from '../state/types.js'
import type { StructuredLogger, StructuredLoggerOptions } from '../logging/structured-logger.js'
// import type { AuthCredentials } from '../types/contracts/v1/socket.js' // Not currently used
import type { Config } from '../types/config.js'
import type { Client as SSH2Client } from 'ssh2'
import type { Socket as SocketIoSocket } from 'socket.io'
import type { Duplex } from 'node:stream'
import type { FileService } from './sftp/file-service.js'
import type { HostKeyService } from './host-key/host-key-service.js'

/**
 * Credentials for authentication
 */
export interface Credentials {
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  host: string
  port: number
  algorithm?: string
}

/**
 * Authentication result
 */
export interface AuthResult {
  sessionId: SessionId
  userId: UserId
  username: string
  method: 'basic' | 'manual' | 'post' | 'keyboard-interactive'
  expiresAt?: number
}

/**
 * A single prompt in a keyboard-interactive authentication request
 */
export interface KeyboardInteractivePrompt {
  /** The prompt text to display to the user */
  prompt: string
  /** Whether the user's input should be echoed (false for passwords) */
  echo: boolean
}

/**
 * Context for a keyboard-interactive authentication request
 */
export interface KeyboardInteractiveContext {
  /** Name of the authentication method (may be empty) */
  name: string
  /** Instructions to display to the user (may be empty) */
  instructions: string
  /** Array of prompts requiring user responses */
  prompts: KeyboardInteractivePrompt[]
}

/**
 * Handler function for keyboard-interactive authentication prompts.
 * Called when the SSH server requests user input during authentication.
 *
 * @param context - The authentication context with prompts
 * @param respond - Callback to provide responses (one per prompt, in order)
 */
export type KeyboardInteractiveHandler = (
  context: KeyboardInteractiveContext,
  respond: (responses: string[]) => void
) => void

/**
 * SSH configuration
 */
export interface SSHConfig {
  sessionId: SessionId
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  readyTimeout?: number
  keepaliveInterval?: number
  keepaliveCountMax?: number
  algorithms?: Record<string, string[]>
  /**
   * Handler for keyboard-interactive authentication prompts.
   * When provided, prompts that cannot be auto-answered will be forwarded
   * to this handler for user interaction.
   */
  onKeyboardInteractive?: KeyboardInteractiveHandler
  /**
   * When true, all keyboard-interactive prompts are forwarded to the handler,
   * bypassing auto-answer logic for password prompts.
   */
  forwardAllPrompts?: boolean
  /**
   * Socket.IO socket for host key verification communication with client.
   * When provided alongside an enabled HostKeyService, the SSH service
   * will set up the hostVerifier callback for the connection.
   */
  socket?: SocketIoSocket
}

/**
 * SSH connection
 */
export interface SSHConnection {
  id: ConnectionId
  sessionId: SessionId
  client: SSH2Client
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  createdAt: number
  lastActivity: number
  host: string
  port: number
  username?: string
}

/**
 * Shell options
 */
export interface ShellOptions {
  term?: string
  rows?: number
  cols?: number
  env?: Record<string, string>
}

/**
 * Terminal options
 */
export interface TerminalOptions {
  sessionId: SessionId
  term?: string
  rows?: number
  cols?: number
  cwd?: string
  env?: Record<string, string>
}

/**
 * Terminal dimensions
 */
export interface Dimensions {
  rows: number
  cols: number
}

/**
 * Terminal instance
 */
export interface Terminal {
  id: string
  sessionId: SessionId
  term: string
  rows: number
  cols: number
  env: Record<string, string>
}

/**
 * Execution result
 */
export interface ExecResult {
  stdout: string
  stderr: string
  code: number
}

/**
 * Session parameters
 */
export interface SessionParams {
  id?: SessionId
  userId?: UserId
  clientIp?: string
  userAgent?: string
}

/**
 * Session instance
 */
export interface Session {
  id: SessionId
  state: SessionState
  createdAt: number
  updatedAt: number
}

/**
 * Authentication service interface
 */
export interface AuthService {
  /**
   * Authenticate with credentials
   */
  authenticate(credentials: Credentials): Promise<Result<AuthResult>>
  
  /**
   * Validate a session
   */
  validateSession(sessionId: SessionId): Result<boolean>
  
  /**
   * Revoke a session
   */
  revokeSession(sessionId: SessionId): Promise<Result<void>>
  
  /**
   * Get session info
   */
  getSessionInfo(sessionId: SessionId): Result<AuthResult | null>
}

/**
 * SSH service interface
 */
export interface SSHService {
  /**
   * Connect to SSH server
   */
  connect(config: SSHConfig): Promise<Result<SSHConnection>>
  
  /**
   * Open a shell
   */
  shell(connectionId: ConnectionId, options: ShellOptions): Promise<Result<Duplex>>
  
  /**
   * Execute a command
   */
  exec(connectionId: ConnectionId, command: string): Promise<Result<ExecResult>>
  
  /**
   * Disconnect
   */
  disconnect(connectionId: ConnectionId): Promise<Result<void>>
  
  /**
   * Get connection status
   */
  getConnectionStatus(connectionId: ConnectionId): Result<SSHConnection | null>
}

/**
 * Terminal service interface
 */
export interface TerminalService {
  /**
   * Create a terminal
   */
  create(options: TerminalOptions): Result<Terminal>
  
  /**
   * Resize terminal
   */
  resize(sessionId: SessionId, dimensions: Dimensions): Result<void>
  
  /**
   * Write to terminal
   */
  write(sessionId: SessionId, data: string): Result<void>
  
  /**
   * Destroy terminal
   */
  destroy(sessionId: SessionId): Result<void>
  
  /**
   * Get terminal info
   */
  getTerminal(sessionId: SessionId): Result<Terminal | null>
}

/**
 * Session service interface
 */
export interface SessionService {
  /**
   * Create a session
   */
  create(params: SessionParams): Result<Session>
  
  /**
   * Get a session
   */
  get(id: SessionId): Result<Session | null>
  
  /**
   * Update a session
   */
  update(id: SessionId, updates: Partial<SessionState>): Result<Session>
  
  /**
   * Delete a session
   */
  delete(id: SessionId): Result<void>
  
  /**
   * List all sessions
   */
  list(): Result<Session[]>
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, error?: Error, meta?: Record<string, unknown>): void
}

/**
 * File service interface
 *
 * Implemented by both SftpService (SFTP subsystem) and ShellFileService
 * (shell commands for BusyBox). The socket adapter depends only on this.
 */
export type { FileService } from './sftp/file-service.js'

/**
 * Protocol type discriminator
 */
export type ProtocolType = 'ssh' | 'telnet'

/**
 * Protocol-agnostic connection state
 */
export interface ProtocolConnection {
  id: ConnectionId
  sessionId: SessionId
  protocol: ProtocolType
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  createdAt: number
  lastActivity: number
  host: string
  port: number
  username?: string
}

/**
 * Telnet-specific connection configuration
 */
export interface TelnetConnectionConfig {
  sessionId: SessionId
  host: string
  port: number
  username?: string
  password?: string
  timeout: number
  term: string
  loginPrompt?: RegExp
  passwordPrompt?: RegExp
  failurePattern?: RegExp
  expectTimeout?: number
}

/**
 * Protocol service interface (common subset for SSH and Telnet)
 */
export interface ProtocolService {
  connect(config: TelnetConnectionConfig): Promise<Result<ProtocolConnection>>
  shell(connectionId: ConnectionId, options: ShellOptions): Promise<Result<Duplex>>
  resize(connectionId: ConnectionId, rows: number, cols: number): Result<void>
  disconnect(connectionId: ConnectionId): Promise<Result<void>>
  getConnectionStatus(connectionId: ConnectionId): Result<ProtocolConnection | null>
}

/**
 * Collection of all services
 */
export interface Services {
  auth: AuthService
  ssh: SSHService
  terminal: TerminalService
  session: SessionService
  sftp?: FileService
  hostKey?: HostKeyService
  telnet?: ProtocolService
}

/**
 * Service dependencies
 */
export interface ServiceDependencies {
  config: Config
  logger: Logger
  createStructuredLogger: (options?: StructuredLoggerOptions) => StructuredLogger
}
