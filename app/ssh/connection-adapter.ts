// app/ssh/connection-adapter.ts
// SSH connection I/O adapter

import type { EventEmitter } from 'events'
import { randomUUID } from 'node:crypto'
import { createNamespacedDebug } from '../logger.js'
import type { Config } from '../types/config.js'
import type { AuthCredentials } from '../types/contracts/v1/socket.js'
import type { SSHCtor } from '../types/ssh.js'

const debug = createNamespacedDebug('ssh:adapter')

export interface SSHConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  algorithms?: Record<string, unknown>
  readyTimeout?: number
  keepaliveInterval?: number
}

export interface ShellOptions {
  term?: string
  rows?: number
  cols?: number
  width?: number
  height?: number
}

export interface ExecOptions {
  pty?: boolean
  term?: string
  rows?: number
  cols?: number
  width?: number
  height?: number
}

export interface Connection {
  id: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  connectedAt?: Date
  error?: string
}

export type Stream = EventEmitter & {
  write?: (data: string) => void
  end?: () => void
  stderr?: EventEmitter
  signal?: (signal: string) => void
  close?: () => void
}

export interface ConnectionResult {
  success: boolean
  connection?: Connection
  error?: string
}

export interface StreamResult {
  success: boolean
  stream?: Stream
  error?: string
}

/**
 * Creates SSH configuration from credentials
 * @param credentials - Authentication credentials
 * @param config - Server configuration
 * @returns SSH configuration
 * @pure
 */
export function createSSHConfig(
  credentials: AuthCredentials,
  config: Config
): SSHConfig {
  const sshConfig: SSHConfig = {
    host: credentials.host,
    port: credentials.port,
    username: credentials.username,
  }

  // Add authentication method
  if (credentials.password != null) {
    sshConfig.password = credentials.password
  }
  
  if (credentials.privateKey != null) {
    sshConfig.privateKey = credentials.privateKey
    if (credentials.passphrase != null) {
      sshConfig.passphrase = credentials.passphrase
    }
  }

  // Add server default private key if needed
  if (config.user.privateKey != null && 
      config.user.privateKey !== '' && 
      sshConfig.privateKey == null) {
    sshConfig.privateKey = config.user.privateKey
  }

  // Add algorithm configuration from ssh.algorithms
  // Note: algorithms is always defined in the config type
  sshConfig.algorithms = config.ssh.algorithms as unknown as Record<string, unknown>

  // Add timeout configuration
  // Note: these are always defined in the config type
  if (config.ssh.readyTimeout > 0) {
    sshConfig.readyTimeout = config.ssh.readyTimeout
  }

  if (config.ssh.keepaliveInterval > 0) {
    sshConfig.keepaliveInterval = config.ssh.keepaliveInterval
  }

  return sshConfig
}

/**
 * Parses SSH error for user-friendly message
 * @param error - SSH error
 * @returns User-friendly error message
 * @pure
 */
export function parseSSHError(error: unknown): string {
  if (error == null) {
    return 'SSH connection failed'
  }

  if (typeof error === 'string') {
    return error
  }

  const err = error as Error & { code?: string; level?: string }

  // Handle specific error codes
  if (err.code != null) {
    switch (err.code) {
      case 'ECONNREFUSED':
        return 'Connection refused - check host and port'
      case 'ENOTFOUND':
        return 'Host not found - check hostname'
      case 'ETIMEDOUT':
        return 'Connection timeout - host may be unreachable'
      case 'EHOSTUNREACH':
        return 'Host unreachable - check network connection'
      case 'ENETUNREACH':
        return 'Network unreachable'
      case 'ECONNRESET':
        return 'Connection reset by peer'
      case 'ERR_SOCKET_CLOSED':
        return 'Socket closed unexpectedly'
    }
  }

  // Handle authentication errors  
  // Cast to check for level property
  const sshErr = err as { level?: string }
  if (sshErr.level === 'client-authentication') {
    return 'Authentication failed - check credentials'
  }

  // Use error message if available
  // Note: Error.message is always defined as a string
  return err.message !== '' ? err.message : 'SSH connection failed'
}

/**
 * Generates unique connection ID
 * @returns Connection ID
 * @pure
 */
export function generateConnectionId(): string {
  return `conn_${randomUUID()}`
}

/**
 * SSH connection adapter for managing SSH connections
 * Handles all SSH I/O operations
 */
export class SSHConnectionAdapter {
  private sshClient: InstanceType<SSHCtor> | null = null
  private connection: Connection | null = null
  private readonly config: Config
  private readonly SSHConnectionClass: SSHCtor

  constructor(config: Config, SSHConnectionClass: SSHCtor) {
    this.config = config
    this.SSHConnectionClass = SSHConnectionClass
  }

  /**
   * Connect to SSH server
   */
  async connect(credentials: AuthCredentials): Promise<ConnectionResult> {
    try {
      // Create SSH configuration
      const sshConfig = createSSHConfig(credentials, this.config)
      
      // Create new SSH client
      this.sshClient = new this.SSHConnectionClass(this.config)
      
      // Create connection record
      this.connection = {
        id: generateConnectionId(),
        status: 'connecting',
      }
      
      debug(`Connecting to ${sshConfig.host}:${sshConfig.port}`)
      
      // Attempt connection
      await this.sshClient.connect(sshConfig as unknown as Record<string, unknown>)
      
      // Update connection status
      this.connection.status = 'connected'
      this.connection.connectedAt = new Date()
      
      debug(`Connected successfully: ${this.connection.id}`)
      
      return {
        success: true,
        connection: { ...this.connection },
      }
    } catch (error) {
      const errorMessage = parseSSHError(error)
      debug(`Connection failed: ${errorMessage}`)
      
      if (this.connection != null) {
        this.connection.status = 'error'
        this.connection.error = errorMessage
      }
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Create SSH shell
   */
  async shell(
    options: ShellOptions,
    env?: Record<string, string> | null
  ): Promise<StreamResult> {
    if (this.sshClient == null) {
      return {
        success: false,
        error: 'SSH client not connected',
      }
    }

    try {
      debug('Creating shell with options:', options)
      
      const stream = await this.sshClient.shell(options, env) as Stream
      
      debug('Shell created successfully')
      
      return {
        success: true,
        stream,
      }
    } catch (error) {
      const errorMessage = parseSSHError(error)
      debug(`Shell creation failed: ${errorMessage}`)
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Execute command over SSH
   */
  async exec(
    command: string,
    options: ExecOptions,
    env?: Record<string, string>
  ): Promise<StreamResult> {
    if (this.sshClient == null) {
      return {
        success: false,
        error: 'SSH client not connected',
      }
    }

    try {
      debug(`Executing command: ${command}`)

      const stream = await this.sshClient.exec(command, options, env) as Stream
      
      debug('Command execution started')
      
      return {
        success: true,
        stream,
      }
    } catch (error) {
      const errorMessage = parseSSHError(error)
      debug(`Command execution failed: ${errorMessage}`)
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Resize terminal
   */
  resizeTerminal(rows: number, cols: number): void {
    if (this.sshClient?.resizeTerminal != null) {
      debug(`Resizing terminal to ${cols}x${rows}`)
      this.sshClient.resizeTerminal(rows, cols)
    }
  }

  /**
   * End SSH connection
   */
  end(): void {
    if (this.sshClient?.end != null) {
      try {
        debug('Ending SSH connection')
        this.sshClient.end()
      } catch (error) {
        debug('Error ending SSH connection:', error)
      }
    }
    
    if (this.connection != null) {
      this.connection.status = 'disconnected'
    }
    
    this.sshClient = null
  }

  /**
   * Get connection status
   */
  getConnection(): Connection | null {
    return this.connection != null ? { ...this.connection } : null
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection != null && this.connection.status === 'connected'
  }
}