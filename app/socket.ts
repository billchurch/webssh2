// server
// app/socket.ts

import validator from 'validator'
import { EventEmitter } from 'events'
import type { IncomingMessage } from 'node:http'
import type { Server as IOServer, Socket as IOSocket } from 'socket.io'
import { createNamespacedDebug } from './logger.js'
import { SSHConnectionError } from './errors.js'
import { maskSensitiveData, validateSshTerm, normalizeDim } from './utils.js'
import { UnifiedAuthPipeline } from './auth/auth-pipeline.js'
import { DEFAULTS } from './constants.js'
import { validateExecPayload } from './validators/exec-validate.js'
// Type stub for validate module (JS)

type ExecParsed = ReturnType<typeof validateExecPayload>
import type { Config } from './types/config.js'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types/contracts/v1/socket.js'
import type { Credentials } from './utils.js'

const debug = createNamespacedDebug('socket')

type WSSocket = IOSocket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

interface SessionData {
  usedBasicAuth?: boolean
  sshCredentials?: Credentials
  envVars?: Record<string, string>
  authMethod?: string
  authFailed?: boolean
  [key: string]: unknown
}

type ExtendedRequest = IncomingMessage & { session?: SessionData; res?: unknown }

export type SSHCtor = new (config: Config) => {
  connect: (creds: Record<string, unknown>) => Promise<unknown>
  shell: (
    options: {
      term?: string | null
      rows?: number
      cols?: number
      width?: number
      height?: number
    },
    env?: Record<string, string> | null
  ) => Promise<
    EventEmitter & { write?: (d: unknown) => void; end?: () => void; stderr?: EventEmitter }
  >
  exec: (
    command: string,
    options: {
      pty?: boolean
      term?: string
      rows?: number
      cols?: number
      width?: number
      height?: number
    },
    env?: Record<string, string>
  ) => Promise<
    EventEmitter & {
      write?: (d: unknown) => void
      stderr?: EventEmitter
      signal?: (s: string) => void
      close?: () => void
    }
  >
  resizeTerminal?: (rows: number | null, cols: number | null) => void
  end?: () => void
}

class WebSSH2Socket extends EventEmitter {
  private readonly socket: WSSocket
  private readonly config: Config
  private readonly SSHConnectionClass: SSHCtor
  private ssh: InstanceType<SSHCtor> | null
  private shellStream:
    | (EventEmitter & { write?: (d: unknown) => void; end?: () => void; stderr?: EventEmitter })
    | null
  private sessionState: {
    authenticated: boolean
    username: string | null
    password: string | null
    privateKey: string | null
    passphrase: string | null
    host: string | null
    port: number | null
    term: string | null
    cols: number | null
    rows: number | null
  }
  private shellStarted: boolean
  private onClientData: ((chunk: unknown) => void) | null
  private readonly authPipeline: UnifiedAuthPipeline

  constructor(socket: WSSocket, config: Config, SSHConnectionClass: SSHCtor) {
    super()
    this.socket = socket
    this.config = config
    this.SSHConnectionClass = SSHConnectionClass
    this.ssh = null
    this.shellStream = null
    this.shellStarted = false
    this.onClientData = null
    this.authPipeline = new UnifiedAuthPipeline(socket.request as ExtendedRequest, config)
    this.sessionState = {
      authenticated: false,
      username: null,
      password: null,
      privateKey: null,
      passphrase: null,
      host: null,
      port: null,
      term: null,
      cols: null,
      rows: null,
    }
    this.initializeSocketEvents()
  }

  private initializeSocketEvents(): void {
    debug(`io.on connection: ${this.socket.id}`)

    // Use unified auth pipeline to determine authentication method
    if (this.authPipeline.isAuthenticated()) {
      const authMethod = this.authPipeline.getAuthMethod()
      const creds = this.authPipeline.getCredentials()
      debug(
        `handleConnection: ${this.socket.id}, ${authMethod} Credentials Exist, creds: %O`,
        this.authPipeline.getMaskedCredentials()
      )
      if (creds != null) {
        this.handleAuthenticate(creds as Record<string, unknown>)
      }
    } else if (this.authPipeline.requiresAuthRequest()) {
      if (this.config.ssh.disableInteractiveAuth) {
        debug(`handleConnection: ${this.socket.id}, interactive auth disabled`)
        this.handleError('Interactive Auth Disabled')
        return
      }
      debug(`handleConnection: ${this.socket.id}, emitting request_auth`)
      this.socket.emit('authentication', { action: 'request_auth' })
    }

    this.socket.on('authenticate', (creds: unknown) =>
      this.handleAuthenticate(creds as Record<string, unknown>)
    )
    this.socket.on('terminal', (data: unknown) => {
      this.handleTerminal(data as Record<string, unknown>)
      // Start shell on first terminal message
      if (!this.shellStarted) {
        void this.startShell()
      }
    })
    this.socket.on('exec', (payload: unknown) => this.handleExec(payload))
    this.socket.on('resize', (size: unknown) => this.handleResize(size))
    this.socket.on('control', (msg: unknown) => this.handleControl(msg))
    this.socket.on('disconnect', (reason: unknown) => this.handleConnectionClose(reason))
  }

  private handleAuthenticate(creds: Record<string, unknown>): void {
    debug(`handleAuthenticate: ${this.socket.id}, %O`, maskSensitiveData(creds))

    // Track original auth method before switching to manual
    const originalAuthMethod = this.authPipeline.getAuthMethod()

    // When credentials are explicitly provided (e.g., from the modal), always update them
    // This ensures that user-provided credentials override any session-stored credentials
    // including when the user changes connection parameters like the port
    if (Object.keys(creds).length > 0) {
      if (!this.authPipeline.setManualCredentials(creds)) {
        debug(`handleAuthenticate: ${this.socket.id}, CREDENTIALS INVALID`)
        this.socket.emit('authentication', {
          action: 'auth_result',
          success: false,
          message: 'Invalid credentials format',
        })
        return
      }

      // CRITICAL: Also update session credentials so reconnections use the new values
      // This fixes the issue where updated port/host from modal were ignored on reconnect
      const req = this.socket.request as ExtendedRequest
      if (req.session != null && creds['host'] != null && creds['host'] !== '' && creds['port'] != null && creds['username'] != null && creds['username'] !== '' && creds['password'] != null && creds['password'] !== '') {
        debug(`handleAuthenticate: Updating session credentials with new user input`)
        req.session.sshCredentials = {
          host: creds['host'] as string,
          port: creds['port'] as number,
          username: creds['username'] as string,
          password: creds['password'] as string,
        }
        if (creds['term'] != null && creds['term'] !== '') {
          req.session.sshCredentials.term = creds['term'] as string
        }
      }

      debug(
        `handleAuthenticate: Updated credentials from user input (was ${originalAuthMethod}, now manual)`
      )
    }

    // Track original auth method for debugging
    debug(`handleAuthenticate: originalAuthMethod=${originalAuthMethod}`)

    const validCreds = this.authPipeline.getCredentials()
    if (validCreds == null) {
      debug(`handleAuthenticate: ${this.socket.id}, NO CREDENTIALS AVAILABLE`)
      this.socket.emit('authentication', {
        action: 'auth_result',
        success: false,
        message: 'No credentials available',
      })
      return
    }

    const validatedTerm = validateSshTerm(validCreds.term)
    this.sessionState.term = validatedTerm ?? (this.config.ssh.term)
    debug(
      `handleAuthenticate: creds.term='${validCreds.term}', validatedTerm='${validatedTerm}', sessionState.term='${this.sessionState.term}'`
    )

    // Handle dimension parameters from manual auth
    if ('cols' in creds && validator.isInt(String(creds['cols']))) {
      this.sessionState.cols = parseInt(String(creds['cols']), 10)
    }
    if ('rows' in creds && validator.isInt(String(creds['rows']))) {
      this.sessionState.rows = parseInt(String(creds['rows']), 10)
    }

    this.initializeConnection(validCreds as Record<string, unknown>).catch((err) =>
      this.handleError('connect', err as Error)
    )
  }

  private async initializeConnection(creds: Record<string, unknown>): Promise<void> {
    const c = { ...(creds as Credentials) }
    if (this.config.user.privateKey != null && this.config.user.privateKey !== '' && (c.privateKey == null || c.privateKey === '')) {
      c.privateKey = this.config.user.privateKey
    }
    this.ssh = new this.SSHConnectionClass(this.config)

    try {
      await this.ssh.connect(c)
      // Clear auth failed flag on successful authentication
      const req = this.socket.request as ExtendedRequest
      if (req.session != null) {
        delete req.session.authFailed
      }

      this.sessionState = Object.assign({}, this.sessionState, {
        authenticated: true,
        username: c.username ?? null,
        password: c.password ?? null,
        privateKey: c.privateKey ?? null,
        passphrase: c.passphrase ?? null,
        host: c.host ?? null,
        port: c.port ?? null,
      })
      this.socket.emit('authentication', { action: 'auth_result', success: true })
      this.socket.emit('permissions', {
        autoLog: !!this.config.options.autoLog,
        allowReplay: !!this.config.options.allowReplay,
        allowReconnect: !!this.config.options.allowReconnect,
        allowReauth: !!this.config.options.allowReauth,
      })
      this.socket.emit('getTerminal', true)

      // Update footer with connection status
      const connectionString = `ssh://${this.sessionState.host}:${this.sessionState.port}`
      this.socket.emit('updateUI', { element: 'footer', value: connectionString })
    } catch (err) {
      const authMethod = this.authPipeline.getAuthMethod()
      const error = err as Error & { code?: string }
      debug(`Authentication failed, authMethod: ${authMethod}, error: ${error.message}`)

      // Clear session credentials on network/connectivity errors to prevent stuck loops
      // Network errors indicate the host/port is wrong, not the credentials
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENETUNREACH' ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout')
      ) {
        debug(
          `Network error detected (${error.code ?? 'unknown'}), clearing session credentials to prevent loop`
        )
        const req = this.socket.request as ExtendedRequest
        if (req.session != null) {
          delete req.session.sshCredentials
          delete req.session.usedBasicAuth
          delete req.session.authMethod
          debug('Session credentials cleared due to network error')
        }
      }

      const errorMessage = err instanceof SSHConnectionError ? err.message : 'SSH connection failed'
      this.socket.emit('authentication', {
        action: 'auth_result',
        success: false,
        message: errorMessage,
      })
    }
  }

  private async handleExec(payload: unknown): Promise<void> {
    if (this.ssh == null) {
      this.socket.emit('ssherror', 'SSH not initialized')
      return
    }
    let parsed: ExecParsed
    try {
      parsed = validateExecPayload(payload)
    } catch (e) {
      const msg =
        (e != null && typeof e === 'object' && 'message' in e)
          ? String((e as { message?: unknown }).message)
          : 'Invalid exec request'
      this.socket.emit('ssherror', `Invalid exec request: ${msg}`)
      return
    }

    const execOptions: {
      pty?: boolean
      term?: string
      cols?: number
      rows?: number
      width?: number
      height?: number
    } = {}
    if (parsed.pty === true) {
      execOptions.pty = true
    }
    execOptions.term = (parsed.term ?? this.sessionState.term ?? DEFAULTS.SSH_TERM)
    // Keep legacy falsy semantics: 0 should fallback to default (tests rely on this)
    execOptions.cols = normalizeDim(parsed.cols, this.sessionState.cols, DEFAULTS.TERM_COLS)
    execOptions.rows = normalizeDim(parsed.rows, this.sessionState.rows, DEFAULTS.TERM_ROWS)
    const sessionEnv = ((this.socket.request as ExtendedRequest).session?.envVars ?? {})
    const mergedEnv = { ...sessionEnv, ...(parsed.env ?? {}) }

    const stream = await this.ssh.exec(parsed.command, execOptions, mergedEnv)

    stream.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      this.socket.emit('data', text)
      this.socket.emit('exec-data', { type: 'stdout', data: text })
    })
    if (stream.stderr != null && typeof stream.stderr.on === 'function') {
      stream.stderr.on('data', (data: Buffer) => {
        const text = data.toString('utf-8')
        this.socket.emit('exec-data', { type: 'stderr', data: text })
      })
    }
    stream.on('close', (code: unknown, signal: unknown) => {
      const safeCode = typeof code === 'number' ? code : null
      const safeSignal = typeof signal === 'string' ? signal : null
      this.socket.emit('exec-exit', { code: safeCode, signal: safeSignal })
    })
    stream.on('error', (err: unknown) => {
      this.socket.emit(
        'ssherror',
        `SSH exec error: ${(err as { message?: string }).message ?? String(err)}`
      )
    })
  }

  private handleTerminal(data: Record<string, unknown>): void {
    const { rows, cols } = data
    debug(
      `handleTerminal: received dimensions rows='${rows}' cols='${cols}', using server sessionState.term='${this.sessionState.term}'`
    )
    // Server is now the sole source of truth for term - ignore any term from client
    if (rows != null && validator.isInt(String(rows))) {
      this.sessionState.rows = parseInt(String(rows), 10)
    }
    if (cols != null && validator.isInt(String(cols))) {
      this.sessionState.cols = parseInt(String(cols), 10)
    }
  }

  private handleResize(size: unknown): void {
    const s = (size ?? {}) as { cols?: unknown; rows?: unknown }
    const cols = typeof s.cols === 'number' && Number.isFinite(s.cols) ? s.cols : null
    const rows = typeof s.rows === 'number' && Number.isFinite(s.rows) ? s.rows : null
    if (cols !== null && rows !== null && this.ssh != null && this.ssh.resizeTerminal != null) {
      this.ssh.resizeTerminal(rows, cols)
    }
  }

  private handleControl(msg: unknown): void {
    debug(`control received from ${this.socket.id}: %o`, msg)
    if (msg === 'reauth') {
      debug(`control: reauth requested for socket ${this.socket.id}`)
      this.socket.emit('authentication', { action: 'reauth' })
      return
    }
    if (msg === 'replayCredentials') {
      // Operator-visible audit log without secrets

      console.info(
        `[replayCredentials] socket=${this.socket.id} crlf=${this.config.options.replayCRLF === true ? '1' : '0'}`
      )
      const req = this.socket.request as ExtendedRequest
      const creds = req.session?.sshCredentials
      if (this.config.options.allowReplay !== true) {
        debug(`control: replayCredentials denied by config for ${this.socket.id}`)
        this.socket.emit('ssherror', 'Replay disabled by server configuration')
        return
      }
      const password =
        (creds?.password) ??
        (this.sessionState.password) ??
        undefined
      if (password == null || password === '') {
        debug(`control: replayCredentials requested but no password stored for ${this.socket.id}`)
        this.socket.emit('ssherror', 'No password available to replay')
        return
      }
      if (this.shellStream == null || typeof this.shellStream.write !== 'function') {
        debug(`control: replayCredentials but no active shell stream for ${this.socket.id}`)
        this.socket.emit('ssherror', 'No active terminal to receive replayed credentials')
        return
      }
      try {
        const lineEnd = this.config.options.replayCRLF === true ? '\r\n' : '\r'
        this.shellStream.write(`${password}${lineEnd}`)
        debug(
          `control: replayCredentials wrote ${password.length} chars + <${
            this.config.options.replayCRLF === true ? 'CRLF' : 'CR'
          }> to shell`
        )
      } catch (e) {
        this.socket.emit('ssherror', 'Failed to replay credentials')
        const msg = (e as { message?: string }).message ?? e
        debug(`control: replayCredentials write error for ${this.socket.id}: ${msg}`)
      }
      return
    }
    // Warn on invalid control commands to match legacy behavior

    console.warn('Invalid control message:', msg)
  }

  private handleError(context: string, err?: Error): void {
    const errorMessage = err != null ? `: ${err.message}` : ''
    this.socket.emit('ssherror', `SSH ${context}${errorMessage}`)
    this.handleConnectionClose()
  }

  private handleConnectionClose(code?: unknown, signal?: unknown): void {
    if (this.onClientData != null) {
      this.socket.off('data', this.onClientData)
      this.onClientData = null
    }
    if (this.shellStream != null && typeof this.shellStream.end === 'function') {
      try {
        this.shellStream.end()
      } catch (e) {
        const msg = (e as { message?: string }).message ?? e
        debug(`error ending shell stream: ${msg}`)
      }
    }
    this.shellStream = null
    if (this.ssh != null && typeof this.ssh.end === 'function') {
      try {
        this.ssh.end()
      } catch (e) {
        const msg = (e as { message?: string }).message ?? String(e)
        debug(`handleConnectionClose: error ending SSH: ${msg}`)
      }
    }
    this.ssh = null
    debug(
      `handleConnectionClose: ${this.socket.id}, Code: ${String(code)}, Signal: ${String(signal)}`
    )
    this.socket.disconnect(true)
  }

  private async startShell(): Promise<void> {
    if (this.shellStarted) {
      return
    }
    this.shellStarted = true
    if (this.ssh == null) {
      // Defer until authenticated/connect finished
      this.shellStarted = false
      return
    }
    const req = this.socket.request as ExtendedRequest
    const sessionEnv = (req.session?.envVars ?? {})
    const options = {
      term: this.sessionState.term ?? (this.config.ssh.term),
      rows: this.sessionState.rows ?? DEFAULTS.TERM_ROWS,
      cols: this.sessionState.cols ?? DEFAULTS.TERM_COLS,
    }
    debug(
      `createShell: sessionState.term=${this.sessionState.term}, config.ssh.term=${this.config.ssh.term}, final options.term=${options.term}`
    )
    const stream = await this.ssh.shell(options, sessionEnv)
    this.shellStream = stream

    // Forward client keystrokes to SSH
    this.onClientData = (chunk: unknown) => {
      try {
        const data = typeof chunk === 'string' ? chunk : String(chunk ?? '')
        this.shellStream?.write?.(data)
      } catch (e) {
        const msg = (e as { message?: string }).message ?? e
        debug(`error writing to shell stream: ${msg}`)
      }
    }
    this.socket.on('data', this.onClientData)

    stream.on('data', (data: Buffer) => {
      this.socket.emit('data', data.toString('utf-8'))
    })
    stream.on('close', () => {
      if (this.onClientData != null) {
        this.socket.off('data', this.onClientData)
        this.onClientData = null
      }
      this.shellStream = null
    })
  }
}

export default function init(
  io: IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  config: Config,
  SSHConnectionClass: SSHCtor
): void {
  io.on('connection', (socket: WSSocket) => new WebSSH2Socket(socket, config, SSHConnectionClass))
}
