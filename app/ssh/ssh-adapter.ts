// app/ssh/ssh-adapter.ts
// I/O adapter for SSH connections

import { Client as SSH, type ClientChannel, type ConnectConfig } from 'ssh2'
import { EventEmitter } from 'events'
import type { Result } from '../types/result.js'
import { createNamespacedDebug } from '../logger.js'
import { maskSensitiveData } from '../utils.js'
import {
  type ConnectionConfig,
  type ConnectionState,
  type ShellOptions,
  type ExecOptions,
  createConnectionState,
  updateConnectionState,
  processKeyboardInteractive,
  toSsh2Config
} from './connection-factory.js'
import { extractErrorMessage, createErrorInfo } from './error-handler.js'

const debug = createNamespacedDebug('ssh:adapter')

export interface Stream extends EventEmitter {
  setWindow?: (rows: number, cols: number, height?: number, width?: number) => void
  write?: (data: string | Buffer) => boolean
  end?: () => void
  stderr?: EventEmitter
  signal?: (signal: string) => boolean
  close?: () => void
}

/**
 * SSH Connection Adapter
 * Handles all I/O operations for SSH connections
 */
export class SSHConnectionAdapter extends EventEmitter {
  private client: SSH | null = null
  private state: ConnectionState
  private stream: Stream | null = null
  private config: ConnectionConfig | null = null

  constructor(id?: string) {
    super()
    this.state = {
      id: id ?? `ssh-${Date.now()}`,
      status: 'disconnected',
      host: '',
      port: 0,
      username: ''
    }
  }

  /**
   * Connect to SSH server
   * I/O operation - returns Promise with Result
   */
  async connect(config: ConnectionConfig): Promise<Result<ConnectionState>> {
    debug('Connecting to %s:%d as %s', config.host, config.port, config.username)
    
    // Update state
    this.config = config
    this.state = updateConnectionState(
      createConnectionState(config, this.state.id),
      { status: 'connecting' }
    )

    // Close existing connection if any
    if (this.client != null) {
      this.client.end()
    }

    this.client = new SSH()
    
    return new Promise((resolve) => {
      let isResolved = false

      // Handle connection ready
      this.client?.once('ready', () => {
        debug('Connection ready for %s', config.host)
        isResolved = true
        
        this.state = updateConnectionState(this.state, {
          status: 'connected',
          connectedAt: new Date()
        })
        
        resolve({
          ok: true,
          value: this.state
        })
      })

      // Handle connection error
      this.client?.on('error', (err: unknown) => {
        const errorInfo = createErrorInfo(err)
        debug('Connection error: %s', errorInfo.message)
        
        if (!isResolved) {
          isResolved = true
          
          this.state = updateConnectionState(this.state, {
            status: 'error',
            errorMessage: errorInfo.message
          })
          
          resolve({
            ok: false,
            error: new Error(errorInfo.message)
          })
        }
        
        // Emit error for listeners
        this.emit('error', errorInfo)
      })

      // Handle connection close
      this.client?.on('close', (hadError?: boolean) => {
        debug('Connection closed, hadError: %s', hadError)
        
        if (!isResolved) {
          isResolved = true
          
          this.state = updateConnectionState(this.state, {
            status: 'error',
            errorMessage: 'Connection closed before authentication'
          })
          
          resolve({
            ok: false,
            error: new Error('SSH authentication failed')
          })
        }
        
        this.state = updateConnectionState(this.state, {
          status: 'disconnected'
        })
        
        // Emit close for listeners
        this.emit('close', hadError)
      })

      // Handle keyboard-interactive authentication
      this.client?.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        debug('Keyboard-interactive authentication requested')
        
        const responses = processKeyboardInteractive(
          prompts as Array<{ prompt: string; echo: boolean }>,
          config.password
        )
        
        finish(responses)
      })

      // Start connection
      try {
        const ssh2Config = toSsh2Config(config)
        debug('Connecting with config: %O', maskSensitiveData(ssh2Config))
        this.client?.connect(ssh2Config as ConnectConfig)
      } catch (err) {
        isResolved = true
        const errorMessage = extractErrorMessage(err)
        
        this.state = updateConnectionState(this.state, {
          status: 'error',
          errorMessage
        })
        
        resolve({
          ok: false,
          error: new Error(errorMessage)
        })
      }
    })
  }

  /**
   * Create shell session
   * I/O operation - returns Promise with Result
   */
  async shell(options: ShellOptions): Promise<Result<Stream>> {
    if (this.client == null || this.state.status !== 'connected') {
      return {
        ok: false,
        error: new Error('Not connected')
      }
    }

    debug('Creating shell with options: %O', options)

    return new Promise((resolve) => {
      // SSH2 expects pty options as first parameter and env as second
      const ptyOptions = options.pty
      const envOptions = options.env != null ? { env: options.env } : {}

      this.client?.shell(
        ptyOptions as object,
        envOptions,
        (err: unknown, stream: ClientChannel) => {
          if (err != null) {
            const errorMessage = extractErrorMessage(err)
            debug('Shell creation failed: %s', errorMessage)
            
            resolve({
              ok: false,
              error: new Error(errorMessage)
            })
          } else {
            debug('Shell created successfully')
            this.stream = stream as unknown as Stream
            
            this.state = updateConnectionState(this.state, {})
            
            resolve({
              ok: true,
              value: this.stream
            })
          }
        }
      )
    })
  }

  /**
   * Execute command
   * I/O operation - returns Promise with Result
   */
  async exec(options: ExecOptions): Promise<Result<Stream>> {
    if (this.client == null || this.state.status !== 'connected') {
      return {
        ok: false,
        error: new Error('Not connected')
      }
    }

    debug('Executing command: %s', options.command)
    
    return new Promise((resolve) => {
      const execOptions = options.pty != null
        ? { pty: options.pty, env: options.env }
        : { env: options.env }

      this.client?.exec(
        options.command,
        execOptions as object,
        (err: unknown, stream: ClientChannel) => {
          if (err != null) {
            const errorMessage = extractErrorMessage(err)
            debug('Command execution failed: %s', errorMessage)
            
            resolve({
              ok: false,
              error: new Error(errorMessage)
            })
          } else {
            debug('Command executed successfully')
            this.stream = stream as unknown as Stream
            
            this.state = updateConnectionState(this.state, {})
            
            resolve({
              ok: true,
              value: this.stream
            })
          }
        }
      )
    })
  }

  /**
   * Resize terminal window
   * I/O operation - synchronous
   */
  resizeTerminal(rows: number, cols: number, height?: number, width?: number): void {
    if (this.stream?.setWindow != null) {
      debug('Resizing terminal to %dx%d', cols, rows)
      this.stream.setWindow(rows, cols, height, width)
      this.state = updateConnectionState(this.state, {})
    }
  }

  /**
   * Write data to stream
   * I/O operation - synchronous
   */
  write(data: string | Buffer): boolean {
    if (this.stream?.write != null) {
      const result = this.stream.write(data)
      this.state = updateConnectionState(this.state, {})
      return result
    }
    return false
  }

  /**
   * End the connection
   * I/O operation - synchronous
   */
  disconnect(): void {
    debug('Disconnecting from %s', this.state.host)
    
    if (this.stream != null) {
      this.stream.end?.()
      this.stream = null
    }
    
    if (this.client != null) {
      this.client.end()
      this.client = null
    }
    
    this.state = updateConnectionState(this.state, {
      status: 'disconnected'
    })
  }

  /**
   * Get current connection state
   * Pure operation - no side effects
   */
  getState(): ConnectionState {
    return { ...this.state }
  }

  /**
   * Check if connected
   * Pure operation - no side effects
   */
  isConnected(): boolean {
    return this.state.status === 'connected'
  }

  /**
   * Get stream if available
   * Pure operation - returns reference
   */
  getStream(): Stream | null {
    return this.stream
  }
}