import { Client as SSH } from 'ssh2'
import type { ConnectConfig, ClientChannel } from 'ssh2'
import { EventEmitter } from 'events'
import { createNamespacedDebug } from './logger.js'
import { SSHConnectionError } from './errors.js'
import { maskSensitiveData } from './utils.js'
import { validatePrivateKey, isEncryptedKey } from './validation/ssh.js'
import { filterEnvironmentVariables } from './connection/environment-filter.js'
import type { Config } from './types/config.js'

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
  private creds: Record<string, unknown> | null

  constructor(config: Config) {
    super()
    this.config = config
    this.conn = null
    this.stream = null
    this.creds = null
  }


  connect(creds: Record<string, unknown>): Promise<unknown> {
    debug('connect: %O', maskSensitiveData(creds))
    this.creds = creds
    if (this.conn != null) {
      this.conn.end()
    }
    this.conn = new SSH()
    const sshConfig = this.getSSHConfig(creds, true)
    debug('Initial connection config: %O', maskSensitiveData(sshConfig))
    return new Promise((resolve, reject) => {
      this.setupConnectionHandlers(resolve, reject)
      try {
        this.conn?.connect(sshConfig as unknown as ConnectConfig)
      } catch (err: unknown) {
        reject(
          new SSHConnectionError(`Connection failed: ${(err as { message?: string }).message}`)
        )
      }
    })
  }

  private setupConnectionHandlers(
    resolve: (v: unknown) => void,
    reject: (e: unknown) => void
  ): void {
    let isResolved = false

    this.conn?.on('ready', () => {
      let host = ''
      const hostValue = (this.creds)?.['host']
      if (hostValue != null) {
        if (typeof hostValue === 'string' || typeof hostValue === 'number') {
          host = String(hostValue)
        } else {
          host = '[object]'
        }
      }
      debug(`connect: ready: ${host}`)
      isResolved = true
      resolve(this.conn)
    })
    this.conn?.on('error', (err: unknown) => {
      const e = err as { message?: string; code?: string; level?: string }
      // Intentionally use `||` so empty strings fall back to meaningful alternatives
       
      const errorMessage = e.message ?? e.code ?? 
        (err instanceof Error ? err.toString() : '[Unknown error]')
      if (isResolved === false) {
        isResolved = true
        const sshError = new SSHConnectionError(errorMessage)
        // Preserve original error properties for error type detection
        Object.assign(sshError, { code: e.code, level: e.level })
        reject(sshError)
      }
    })
    this.conn?.on('close', (hadError?: boolean) => {
      debug(`connect: close: hadError=${hadError}, isResolved=${isResolved}`)
      if (isResolved === false) {
        isResolved = true
        reject(new SSHConnectionError('SSH authentication failed - connection closed'))
      }
    })
    this.conn?.on('keyboard-interactive', (name, instructions, instructionsLang, prompts) => {
      this.emit('keyboard-interactive', { name, instructions, instructionsLang, prompts })
    })
  }

  shell(
    options: {
      term?: string | null
      rows?: number
      cols?: number
      width?: number
      height?: number
    },
    envVars?: Record<string, string> | null
  ): Promise<unknown> {
    const ptyOptions = {
      term: options.term,
      rows: options.rows,
      cols: options.cols,
      width: options.width,
      height: options.height,
    }
    const envOptions = envVars != null ? { ['env']: this.getEnvironment(envVars) } : undefined
    debug(`shell: Creating shell with PTY options:`, ptyOptions, 'and env options:', envOptions)
    return new Promise((resolve, reject) => {
      this.conn?.shell(
        ptyOptions as unknown as object,
        envOptions as unknown as object,
        (err: unknown, stream: ClientChannel & EventEmitter) => {
          if (err != null) {
            const error = err instanceof Error ? err : 
              new Error(typeof err === 'string' ? err : '[SSH error]')
            reject(error)
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
    const execOptions: Record<string, unknown> = {}
    if (envVars != null) {
      execOptions['env'] = this.getEnvironment(envVars)
    }
    if (options.pty === true) {
      execOptions['pty'] = {
        term: options.term,
        rows: options.rows,
        cols: options.cols,
        width: options.width,
        height: options.height,
      }
    }
    debug('exec: Executing command with options:', command, execOptions)
    return new Promise((resolve, reject) => {
      this.conn?.exec(
        command,
        execOptions as unknown as object,
        (err: unknown, stream: ClientChannel & EventEmitter) => {
          if (err != null) {
            const error = err instanceof Error ? err : 
              new Error(typeof err === 'string' ? err : '[SSH error]')
            reject(error)
          } else {
            this.stream = stream as unknown as EventEmitter
            resolve(stream)
          }
        }
      )
    })
  }

  resizeTerminal(rows: number, cols: number): void {
    if (this.stream != null && typeof this.stream.setWindow === 'function') {
      this.stream.setWindow(rows, cols)
    }
  }

  end(): void {
    if (this.stream != null) {
      this.stream.end?.()
      this.stream = null
    }
    if (this.conn != null) {
      this.conn.end()
      this.conn = null
    }
  }

  private getEnvironment(envVars?: Record<string, unknown>): Record<string, string> {
    return filterEnvironmentVariables(envVars, this.config.ssh.envAllowlist)
  }

  private getSSHConfig(
    creds: Record<string, unknown>,
    tryKeyboard: boolean
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      host: (() => {
        const hostValue = creds['host']
        if (hostValue == null) {
          return ''
        }
        if (typeof hostValue === 'string' || typeof hostValue === 'number') {
          return String(hostValue)
        }
        return ''
      })(),
      port: Number(creds['port'] ?? 22),
      username: (creds['username'] as string | undefined) ?? undefined,
      tryKeyboard,
      algorithms: this.config.ssh.algorithms as unknown,
      readyTimeout: this.config.ssh.readyTimeout,
      keepaliveInterval: this.config.ssh.keepaliveInterval,
      keepaliveCountMax: this.config.ssh.keepaliveCountMax,
      debug: (msg: string) => debug(msg),
    }
    const privateKey = (creds['privateKey'] as string | undefined) ?? undefined
    const passphrase = (creds['passphrase'] as string | undefined) ?? undefined
    const password = (creds['password'] as string | undefined) ?? undefined
    if (privateKey != null && privateKey !== '' && validatePrivateKey(privateKey)) {
      ;(base as { privateKey?: string }).privateKey = privateKey
      if (isEncryptedKey(privateKey) && passphrase != null && passphrase !== '') {
        ;(base as { passphrase?: string }).passphrase = passphrase
      }
    }
    if (password != null && password !== '') {
      ;(base as { password?: string }).password = password
    }
    return base
  }
}
