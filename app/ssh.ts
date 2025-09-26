// app/ssh.ts
// SSH connection orchestration layer

import { Client as SSH } from 'ssh2'
import type { ConnectConfig, ClientChannel } from 'ssh2'
import { EventEmitter } from 'node:events'
import { createNamespacedDebug } from './logger.js'
import { SSHConnectionError } from './errors.js'
import { maskSensitiveData } from './utils.js'
import { filterEnvironmentVariables } from './connection/environment-filter.js'
import type { Config } from './types/config.js'

// Import pure functions from decomposed modules
import {
  buildSshConfig,
  createPtyOptions,
  createExecOptions,
  extractHost,
  type SshCredentials,
  type PtyOptions
} from './ssh/config-builder.js'

import {
  extractErrorMessage,
  createErrorInfo,
  formatErrorForLog
} from './ssh/error-handler.js'

const debug = createNamespacedDebug('ssh')

export default class SSHConnection extends EventEmitter {
  private readonly config: Config
  private conn: SSH | null
  private stream:
    | (EventEmitter & {
        setWindow?: (...args: unknown[]) => void
        write?: (d: unknown) => void
        end?: () => void
        stderr?: EventEmitter
        signal?: (s: string) => void
        close?: () => void
      })
    | null
  private creds: SshCredentials | null

  constructor(config: Config) {
    super()
    this.config = config
    this.conn = null
    this.stream = null
    this.creds = null
  }

  connect(creds: SshCredentials): Promise<unknown> {
    debug('connect: %O', maskSensitiveData(creds))
    this.creds = creds
    
    if (this.conn !== null) {
      this.conn.end()
    }
    
    this.conn = new SSH()
    
    // Build SSH config using pure function
    const sshConfig = buildSshConfig(
      creds, 
      this.config, 
      true,
      (msg: string) => debug(msg)
    )
    
    debug('Initial connection config: %O', maskSensitiveData(sshConfig))
    
    return new Promise((resolve, reject) => {
      this.setupConnectionHandlers(resolve, reject)
      try {
        this.conn?.connect(sshConfig as unknown as ConnectConfig)
      } catch (err: unknown) {
        const errorMessage = extractErrorMessage(err)
        reject(new SSHConnectionError(`Connection failed: ${errorMessage}`))
      }
    })
  }

  private setupConnectionHandlers(
    resolve: (v: unknown) => void,
    reject: (e: unknown) => void
  ): void {
    let isResolved = false

    this.conn?.on('ready', () => {
      // Extract host using pure function
      const host = this.creds !== null ? extractHost(this.creds) : ''
      debug(`connect: ready: ${host !== '' ? host : '[no host]'}`)
      isResolved = true
      resolve(this.conn)
    })
    
    this.conn?.on('error', (err: unknown) => {
      // Create error info using pure function
      const errorInfo = createErrorInfo(err)
      const logMessage = formatErrorForLog(err)
      debug(`connect: error: ${logMessage}`)
      
      if (!isResolved) {
        isResolved = true
        const sshError = new SSHConnectionError(errorInfo.message)
        // Preserve original error properties for error type detection
        Object.assign(sshError, { 
          code: errorInfo.code, 
          level: errorInfo.level 
        })
        reject(sshError)
      }
    })
    
    this.conn?.on('close', (hadError?: boolean) => {
      debug(`connect: close: hadError=${hadError}, isResolved=${isResolved}`)
      if (!isResolved) {
        isResolved = true
        reject(new SSHConnectionError('SSH authentication failed - connection closed'))
      }
    })
    
    this.conn?.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      const promptCount = Array.isArray(prompts) ? prompts.length : 0
      debug(`keyboard-interactive: ${name}, prompts: ${promptCount}`)
      
      // Auto-respond with password for keyboard-interactive authentication
      // This handles cases where the SSH server requires keyboard-interactive auth
      // instead of or in addition to password auth
      const password = this.creds?.password
      if (password !== undefined && typeof password === 'string' && typeof finish === 'function') {
        const responses: string[] = []
        
        // Respond to each prompt with the password
        // Most servers asking for password via keyboard-interactive will have 1 prompt
        for (let i = 0; i < promptCount; i++) {
          responses.push(password)
        }
        
        debug(`keyboard-interactive: responding to ${promptCount} prompts`)
        finish(responses)
      } else {
        // Emit event for handling by upper layers if no password available
        this.emit('keyboard-interactive', { name, instructions, instructionsLang, prompts })
        
        // Still need to call finish with empty responses to prevent timeout
        if (typeof finish === 'function') {
          finish([])
        }
      }
    })
  }

  shell(
    options: PtyOptions,
    envVars?: Record<string, string> | null
  ): Promise<unknown> {
    // Create PTY options using pure function
    const ptyOptions = createPtyOptions(options)
    
    // Filter environment variables
    const envOptions = envVars !== undefined && envVars !== null
      ? { env: this.getEnvironment(envVars) }
      : undefined
    
    debug(`shell: Creating shell with PTY options:`, ptyOptions, 'and env options:', envOptions)
    
    return new Promise((resolve, reject) => {
      this.conn?.shell(
        ptyOptions,
        envOptions as unknown as object,
        (err: unknown, stream: ClientChannel & EventEmitter) => {
          if (err !== undefined) {
            const errorMessage = extractErrorMessage(err)
            reject(new Error(errorMessage))
          } else {
            this.stream = stream as unknown as EventEmitter
            resolve(stream)
          }
        }
      )
    })
  }

  exec(
    command: string,
    options: {
      pty?: boolean
      term?: string
      rows?: number
      cols?: number
      width?: number
      height?: number
    } = {},
    envVars?: Record<string, string>
  ): Promise<unknown> {
    // Create exec options using pure functions
    const ptyOptions = options.pty === true ? options : undefined
    const filteredEnv = envVars !== undefined ? this.getEnvironment(envVars) : undefined
    const execOptions = createExecOptions(ptyOptions, filteredEnv)
    
    debug('exec: Executing command with options:', command, execOptions)
    
    return new Promise((resolve, reject) => {
      this.conn?.exec(
        command,
        execOptions as unknown as object,
        (err: unknown, stream: ClientChannel & EventEmitter) => {
          if (err !== undefined) {
            const errorMessage = extractErrorMessage(err)
            reject(new Error(errorMessage))
          } else {
            this.stream = stream as unknown as EventEmitter
            resolve(stream)
          }
        }
      )
    })
  }

  resizeTerminal(rows: number, cols: number): void {
    if (this.stream !== null && typeof this.stream.setWindow === 'function') {
      this.stream.setWindow(rows, cols)
    }
  }

  end(): void {
    if (this.stream !== null) {
      this.stream.end?.()
      this.stream = null
    }
    if (this.conn !== null) {
      this.conn.end()
      this.conn = null
    }
  }

  private getEnvironment(envVars?: Record<string, unknown>): Record<string, string> {
    return filterEnvironmentVariables(envVars, this.config.ssh.envAllowlist)
  }
}