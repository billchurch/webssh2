import { Client as SSH } from 'ssh2'
import type { ConnectConfig, ClientChannel } from 'ssh2'
import { EventEmitter } from 'events'
import { createNamespacedDebug } from './logger.js'
import { SSHConnectionError } from './errors.js'
import { maskSensitiveData } from './utils.js'
import type { Config } from './types/config.js'

const debug = createNamespacedDebug('ssh')

export default class SSHConnection extends EventEmitter {
  private config: Config
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

  validatePrivateKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false
    }
    const trimmedKey = key.trim()
    const keyPatterns = [
      /^-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*-----END OPENSSH PRIVATE KEY-----$/,
      /^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*-----END (?:RSA )?PRIVATE KEY-----$/,
      /^-----BEGIN EC PRIVATE KEY-----[\s\S]*-----END EC PRIVATE KEY-----$/,
      /^-----BEGIN DSA PRIVATE KEY-----[\s\S]*-----END DSA PRIVATE KEY-----$/,
      /^-----BEGIN PRIVATE KEY-----[\s\S]*-----END PRIVATE KEY-----$/,
      /^-----BEGIN ENCRYPTED PRIVATE KEY-----[\s\S]*-----END ENCRYPTED PRIVATE KEY-----$/,
    ]
    return keyPatterns.some((pattern) => pattern.test(trimmedKey))
  }

  isEncryptedKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false
    }
    return (
      key.includes('Proc-Type: 4,ENCRYPTED') ||
      key.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----') ||
      (key.includes('-----BEGIN OPENSSH PRIVATE KEY-----') &&
        (key.includes('bcrypt') || key.includes('aes') || key.includes('3des')))
    )
  }

  connect(creds: Record<string, unknown>): Promise<unknown> {
    debug('connect: %O', maskSensitiveData(creds))
    this.creds = creds
    if (this.conn) {
      this.conn.end()
    }
    this.conn = new SSH()
    const sshConfig = this.getSSHConfig(creds, true)
    debug('Initial connection config: %O', maskSensitiveData(sshConfig))
    return new Promise((resolve, reject) => {
      this.setupConnectionHandlers(resolve, reject)
      try {
        this.conn!.connect(sshConfig as unknown as ConnectConfig)
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
    this.conn!.on('ready', () => {
      const host = String((this.creds as Record<string, unknown> | null)?.['host'] ?? '')
      debug(`connect: ready: ${host}`)
      resolve(this.conn)
    })
    this.conn!.on('error', (err: unknown) => {
      const e = err as { message?: string; code?: string }
      const errorMessage = e.message || e.code || String(err) || 'Unknown error'
      reject(new SSHConnectionError(errorMessage))
    })
    this.conn!.on('keyboard-interactive', (name, instructions, instructionsLang, prompts) => {
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
    const envOptions = envVars ? { ['env']: this.getEnvironment(envVars) } : undefined
    debug(`shell: Creating shell with PTY options:`, ptyOptions, 'and env options:', envOptions)
    return new Promise((resolve, reject) => {
      this.conn!.shell(
        ptyOptions as unknown as object,
        envOptions as unknown as object,
        (err: unknown, stream: ClientChannel & EventEmitter) => {
          if (err) {
            reject(err)
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
    if (envVars) {
      execOptions['env'] = this.getEnvironment(envVars)
    }
    if (options.pty) {
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
      this.conn!.exec(
        command,
        execOptions as unknown as object,
        (err: unknown, stream: ClientChannel & EventEmitter) => {
          if (err) {
            reject(err)
          } else {
            this.stream = stream as unknown as EventEmitter
            resolve(stream)
          }
        }
      )
    })
  }

  resizeTerminal(rows: number, cols: number): void {
    if (this.stream && typeof this.stream.setWindow === 'function') {
      this.stream.setWindow(rows, cols)
    }
  }

  end(): void {
    if (this.stream) {
      this.stream.end && this.stream.end()
      this.stream = null
    }
    if (this.conn) {
      this.conn.end()
      this.conn = null
    }
  }

  private getEnvironment(envVars?: Record<string, string>): Record<string, string> {
    const env: Record<string, string> = { TERM: this.config.ssh.term as unknown as string }
    if (envVars) {
      for (const k of Object.keys(envVars)) {
        env[k] = String(envVars[k]!)
      }
    }
    return env
  }

  private getSSHConfig(
    creds: Record<string, unknown>,
    tryKeyboard: boolean
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      host: String(creds['host'] ?? ''),
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
    if (privateKey && this.validatePrivateKey(privateKey)) {
      ;(base as { privateKey?: string }).privateKey = privateKey
      if (this.isEncryptedKey(privateKey) && passphrase) {
        ;(base as { passphrase?: string }).passphrase = passphrase
      }
    }
    if (password) {
      ;(base as { password?: string }).password = password
    }
    return base
  }
}
