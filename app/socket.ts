// server
// app/socket.ts

import validator from 'validator'
import { EventEmitter } from 'events'
import type { IncomingMessage } from 'node:http'
import type { Server as IOServer, Socket as IOSocket } from 'socket.io'
import { createNamespacedDebug } from './logger.js'
import { maskSensitiveData } from './utils.js'
import { UnifiedAuthPipeline } from './auth/auth-pipeline.js'
import { DEFAULTS, MESSAGES } from './constants.js'
import {
  prepareCredentials,
  handleConnectionSuccess,
  handleConnectionFailure,
  createAuthFailurePayload,
  type ConnectionCredentials,
} from './socket/connection-handler.js'
import {
  handleControlMessage,
} from './socket/control-handler.js'
import {
  configureTerminal,
  validateAndUpdateCredentials,
  createSessionStateFromCredentials,
} from './socket/credential-manager.js'
import {
  parseExecPayload,
  createExecOptions,
  mergeEnvironmentVariables,
} from './socket/exec-handler.js'
// Type stub for validate module (JS)

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

    // When credentials are explicitly provided, update them
    if (Object.keys(creds).length > 0) {
      const updateResult = validateAndUpdateCredentials(this.socket, creds, originalAuthMethod)
      if (!updateResult.success) {
        this.socket.emit('authentication', createAuthFailurePayload(updateResult.error ?? 'Unknown error'))
        return
      }
      
      // Update pipeline with manual credentials
      if (!this.authPipeline.setManualCredentials(creds)) {
        debug(`handleAuthenticate: ${this.socket.id}, CREDENTIALS INVALID`)
        this.socket.emit('authentication', createAuthFailurePayload(MESSAGES.INVALID_CREDENTIALS))
        return
      }
    }

    // Get validated credentials
    const validCreds = this.authPipeline.getCredentials()
    if (validCreds == null) {
      this.socket.emit('authentication', createAuthFailurePayload('No credentials available'))
      return
    }

    // Configure terminal and dimensions
    const terminalConfig = configureTerminal(validCreds, creds, this.config)
    this.sessionState.term = terminalConfig.term
    if (terminalConfig.cols != null) {
      this.sessionState.cols = terminalConfig.cols
    }
    if (terminalConfig.rows != null) {
      this.sessionState.rows = terminalConfig.rows
    }

    // Initialize connection
    this.initializeConnection(validCreds as Record<string, unknown>).catch((err) =>
      this.handleError('connect', err as Error)
    )
  }




  private async initializeConnection(creds: Record<string, unknown>): Promise<void> {
    const preparedCreds = prepareCredentials(creds as Credentials, this.config)
    this.ssh = new this.SSHConnectionClass(this.config)

    try {
      await this.ssh.connect(preparedCreds as Record<string, unknown>)
      this.handleSSHConnectionSuccess(preparedCreds)
    } catch (err) {
      handleConnectionFailure(this.socket, err as Error & { code?: string })
    }
  }


  private handleSSHConnectionSuccess(credentials: ConnectionCredentials): void {
    // Update session state
    const newSessionState = createSessionStateFromCredentials(credentials as Record<string, unknown>)
    this.sessionState = Object.assign({}, this.sessionState, newSessionState)

    // Handle success using the extracted handler
    handleConnectionSuccess(this.socket, this.config, credentials)
  }



  private async handleExec(payload: unknown): Promise<void> {
    if (this.ssh == null) {
      this.socket.emit('ssherror', 'SSH not initialized')
      return
    }
    
    // Parse and validate payload
    const parseResult = parseExecPayload(payload)
    if (!parseResult.valid || parseResult.data == null) {
      this.socket.emit('ssherror', `Invalid exec request: ${parseResult.error}`)
      return
    }
    
    const parsed = parseResult.data
    
    // Create execution options
    const execOptions = createExecOptions(
      parsed,
      this.sessionState.term,
      this.sessionState.cols,
      this.sessionState.rows
    )
    
    // Merge environment variables
    const sessionEnv = ((this.socket.request as ExtendedRequest).session?.envVars ?? {})
    const mergedEnv = mergeEnvironmentVariables(sessionEnv, parsed.env)

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
    handleControlMessage(
      this.socket,
      this.config,
      { password: this.sessionState.password },
      this.shellStream,
      msg
    )
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
    const shellOptions = {
      term: this.sessionState.term ?? this.config.ssh.term,
      rows: this.sessionState.rows ?? DEFAULTS.TERM_ROWS,
      cols: this.sessionState.cols ?? DEFAULTS.TERM_COLS,
    }
    
    debug(
      `createShell: sessionState.term=${this.sessionState.term}, config.ssh.term=${this.config.ssh.term}, final options.term=${shellOptions.term}`
    )
    
    const stream = await this.ssh.shell(shellOptions, sessionEnv) as EventEmitter
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
