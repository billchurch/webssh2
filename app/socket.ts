// server
// app/socket.ts

import validator from 'validator'
import { EventEmitter } from 'events'
import type { IncomingMessage } from 'node:http'
import type { Server as IOServer, Socket as IOSocket } from 'socket.io'
import { createNamespacedDebug } from './logger.js'
import { SSHConnectionError } from './errors.js'
import { isValidCredentials, maskSensitiveData, validateSshTerm } from './utils.js'
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

type SessionData = {
  usedBasicAuth?: boolean
  sshCredentials?: Credentials
  envVars?: Record<string, string>
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
  private socket: WSSocket
  private config: Config
  private SSHConnectionClass: SSHCtor
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

  constructor(socket: WSSocket, config: Config, SSHConnectionClass: SSHCtor) {
    super()
    this.socket = socket
    this.config = config
    this.SSHConnectionClass = SSHConnectionClass
    this.ssh = null
    this.shellStream = null
    this.shellStarted = false
    this.onClientData = null
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

    // If HTTP basic-auth populated session creds, auto-authenticate
    const req = this.socket.request as ExtendedRequest
    if (req.session?.usedBasicAuth && req.session.sshCredentials) {
      const creds = req.session.sshCredentials
      debug(
        `handleConnection: ${this.socket.id}, Host: ${creds.host}: HTTP Basic Credentials Exist, creds: %O`,
        maskSensitiveData(creds)
      )
      this.handleAuthenticate(creds as Record<string, unknown>)
    } else if (!this.sessionState.authenticated) {
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
    if (isValidCredentials(creds as Credentials)) {
      this.sessionState.term =
        validateSshTerm((creds as Credentials).term) || (this.config.ssh.term as string)
      if ((creds as Credentials).cols && validator.isInt(String((creds as Credentials).cols))) {
        this.sessionState.cols = parseInt(
          String((creds as Credentials).cols as unknown as string),
          10
        )
      }
      if ((creds as Credentials).rows && validator.isInt(String((creds as Credentials).rows))) {
        this.sessionState.rows = parseInt(
          String((creds as Credentials).rows as unknown as string),
          10
        )
      }

      this.initializeConnection(creds).catch((err) => this.handleError('connect', err as Error))
    } else {
      debug(`handleAuthenticate: ${this.socket.id}, CREDENTIALS INVALID`)
      this.socket.emit('authentication', {
        action: 'auth_result',
        success: false,
        message: 'Invalid credentials format',
      })
    }
  }

  private async initializeConnection(creds: Record<string, unknown>): Promise<void> {
    const c = { ...(creds as Credentials) }
    if (this.config.user.privateKey && !c.privateKey) {
      c.privateKey = this.config.user.privateKey
    }
    this.ssh = new this.SSHConnectionClass(this.config)

    try {
      await this.ssh.connect(c)
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
    } catch (err) {
      const errorMessage = err instanceof SSHConnectionError ? err.message : 'SSH connection failed'
      this.socket.emit('authentication', {
        action: 'auth_result',
        success: false,
        message: errorMessage,
      })
    }
  }

  private async handleExec(payload: unknown): Promise<void> {
    if (!this.ssh) {
      this.socket.emit('ssherror', 'SSH not initialized')
      return
    }
    let parsed: ExecParsed
    try {
      parsed = validateExecPayload(payload)
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in (e as { message?: unknown })
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
    if (parsed.pty) {
      execOptions.pty = true
    }
    execOptions.term = (parsed.term || this.sessionState.term || 'xterm-color') as string
    execOptions.cols = (parsed.cols || this.sessionState.cols || 80) ?? undefined
    execOptions.rows = (parsed.rows || this.sessionState.rows || 24) ?? undefined
    const sessionEnv = ((this.socket.request as ExtendedRequest).session?.envVars || {}) as Record<
      string,
      string
    >
    const mergedEnv = { ...sessionEnv, ...(parsed.env || {}) }

    const stream = await this.ssh.exec(parsed.command, execOptions, mergedEnv)

    stream.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      this.socket.emit('data', text)
      this.socket.emit('exec-data', { type: 'stdout', data: text })
    })
    if (stream.stderr && typeof stream.stderr.on === 'function') {
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
        `SSH exec error: ${(err as { message?: string }).message || String(err)}`
      )
    })
  }

  private handleTerminal(data: Record<string, unknown>): void {
    const { term, rows, cols } = data as Record<string, unknown>
    if (term && validateSshTerm(String(term))) {
      this.sessionState.term = String(term)
    }
    if (rows && validator.isInt(String(rows))) {
      this.sessionState.rows = parseInt(String(rows), 10)
    }
    if (cols && validator.isInt(String(cols))) {
      this.sessionState.cols = parseInt(String(cols), 10)
    }
  }

  private handleResize(size: unknown): void {
    const s = (size || {}) as { cols?: unknown; rows?: unknown }
    const cols = typeof s.cols === 'number' && Number.isFinite(s.cols) ? s.cols : null
    const rows = typeof s.rows === 'number' && Number.isFinite(s.rows) ? s.rows : null
    if (cols != null && rows != null && this.ssh?.resizeTerminal) {
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
        `[replayCredentials] socket=${this.socket.id} crlf=${this.config.options.replayCRLF ? '1' : '0'}`
      )
      const req = this.socket.request as ExtendedRequest
      const creds = req.session?.sshCredentials
      if (!this.config.options.allowReplay) {
        debug(`control: replayCredentials denied by config for ${this.socket.id}`)
        this.socket.emit('ssherror', 'Replay disabled by server configuration')
        return
      }
      const password =
        (creds?.password as string | undefined) ||
        (this.sessionState.password as string | null) ||
        undefined
      if (!password) {
        debug(`control: replayCredentials requested but no password stored for ${this.socket.id}`)
        this.socket.emit('ssherror', 'No password available to replay')
        return
      }
      if (!this.shellStream || typeof this.shellStream.write !== 'function') {
        debug(`control: replayCredentials but no active shell stream for ${this.socket.id}`)
        this.socket.emit('ssherror', 'No active terminal to receive replayed credentials')
        return
      }
      try {
        const lineEnd = this.config.options.replayCRLF ? '\r\n' : '\r'
        this.shellStream.write(`${password}${lineEnd}`)
        debug(
          `control: replayCredentials wrote ${password.length} chars + <${
            this.config.options.replayCRLF ? 'CRLF' : 'CR'
          }> to shell`
        )
      } catch (e) {
        this.socket.emit('ssherror', 'Failed to replay credentials')
        debug(
          `control: replayCredentials write error for ${this.socket.id}: ${(e as { message?: string })?.message || e}`
        )
      }
      return
    }
    // Warn on invalid control commands to match legacy behavior

    console.warn('Invalid control message:', msg)
  }

  private handleError(context: string, err?: Error): void {
    const errorMessage = err ? `: ${err.message}` : ''
    this.socket.emit('ssherror', `SSH ${context}${errorMessage}`)
    this.handleConnectionClose()
  }

  private handleConnectionClose(code?: unknown, signal?: unknown): void {
    if (this.onClientData) {
      this.socket.off('data', this.onClientData)
      this.onClientData = null
    }
    if (this.shellStream && typeof this.shellStream.end === 'function') {
      try {
        this.shellStream.end()
      } catch (e) {
        debug(`error ending shell stream: ${(e as { message?: string })?.message || e}`)
      }
    }
    this.shellStream = null
    if (this.ssh && typeof this.ssh.end === 'function') {
      try {
        this.ssh.end()
      } catch (e) {
        debug(
          `handleConnectionClose: error ending SSH: ${(e as { message?: string })?.message || String(e)}`
        )
      }
    }
    this.ssh = null
    debug(
      `handleConnectionClose: ${this.socket.id}, Code: ${String(code)}, Signal: ${String(signal)}`
    )
    if (this.socket && this.socket.disconnect) {
      this.socket.disconnect(true)
    }
  }

  private async startShell(): Promise<void> {
    if (this.shellStarted) {
      return
    }
    this.shellStarted = true
    if (!this.ssh) {
      // Defer until authenticated/connect finished
      this.shellStarted = false
      return
    }
    const req = this.socket.request as ExtendedRequest
    const sessionEnv = (req.session?.envVars || {}) as Record<string, string>
    const options = {
      term: this.sessionState.term || (this.config.ssh.term as string) || 'xterm-color',
      rows: this.sessionState.rows ?? 24,
      cols: this.sessionState.cols ?? 80,
    }
    const stream = await this.ssh.shell(options, sessionEnv)
    this.shellStream = stream

    // Forward client keystrokes to SSH
    this.onClientData = (chunk: unknown) => {
      try {
        const data = typeof chunk === 'string' ? chunk : String(chunk ?? '')
        this.shellStream?.write?.(data)
      } catch (e) {
        debug(`error writing to shell stream: ${(e as { message?: string })?.message || e}`)
      }
    }
    if (this.onClientData) {
      this.socket.on('data', this.onClientData)
    }

    stream.on('data', (data: Buffer) => {
      this.socket.emit('data', data.toString('utf-8'))
    })
    stream.on('close', () => {
      if (this.onClientData) {
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
