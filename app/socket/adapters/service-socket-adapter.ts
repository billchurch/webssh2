/**
 * Socket adapter that uses services for all operations
 */

import type { Socket } from 'socket.io'
import type { Services } from '../../services/interfaces.js'
import type { SessionStore } from '../../state/store.js'
import type { Config } from '../../types/config.js'
import type { SessionId } from '../../types/branded.js'
import { createConnectionId } from '../../types/branded.js'
import type { Duplex } from 'node:stream'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import { VALIDATION_MESSAGES } from '../../constants/validation.js'
import { TERMINAL_DEFAULTS } from '../../constants/terminal.js'

// SSH2 stream extends Duplex with additional methods
interface SSH2Stream extends Duplex {
  setWindow?(rows: number, cols: number): void
}
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  AuthCredentials,
  TerminalSettings
} from '../../types/contracts/v1/socket.js'
import { createNamespacedDebug } from '../../logger.js'

const debug = createNamespacedDebug('socket:service-adapter')

// Helper functions to reduce cognitive complexity
type OptionalCredentials = Pick<AuthCredentials, 'password' | 'privateKey' | 'passphrase'>

/**
 * Maps optional credential fields from auth credentials
 */
function mapOptionalCredentials(credentials: OptionalCredentials): Partial<OptionalCredentials> {
  const result: Partial<OptionalCredentials> = {}

  debug('Mapping optional credentials:', {
    hasPassword: credentials.password !== undefined && credentials.password !== '',
    hasPrivateKey: credentials.privateKey !== undefined && credentials.privateKey !== '',
    hasPassphrase: credentials.passphrase !== undefined && credentials.passphrase !== ''
  })

  if (credentials.password !== undefined && credentials.password !== '') {
    result.password = credentials.password
    debug('Password added to result (length: %d)', credentials.password.length)
  }
  if (credentials.privateKey !== undefined && credentials.privateKey !== '') {
    result.privateKey = credentials.privateKey
    debug('Private key added to result')
  }
  if (credentials.passphrase !== undefined && credentials.passphrase !== '') {
    result.passphrase = credentials.passphrase
    debug('Passphrase added to result')
  }

  return result
}

/**
 * Builds auth service credentials from socket auth credentials
 */
function buildAuthCredentials(
  credentials: AuthCredentials
): Parameters<Services['auth']['authenticate']>[0] {
  return {
    username: credentials.username,
    host: credentials.host,
    port: credentials.port,
    ...mapOptionalCredentials(credentials)
  }
}

/**
 * Builds SSH service config from credentials and session info
 */
function buildSSHConfig(
  credentials: AuthCredentials,
  sessionId: SessionId,
  config: Config
): Parameters<Services['ssh']['connect']>[0] {
  // Convert AlgorithmsConfig to Record<string, string[]> format expected by ssh2
  const algorithms: Record<string, string[]> = {
    cipher: config.ssh.algorithms.cipher,
    compress: config.ssh.algorithms.compress,
    hmac: config.ssh.algorithms.hmac,
    kex: config.ssh.algorithms.kex,
    serverHostKey: config.ssh.algorithms.serverHostKey
  }

  const optionalCreds = mapOptionalCredentials(credentials)
  const sshConfig = {
    sessionId,
    host: credentials.host,
    port: credentials.port,
    username: credentials.username,
    readyTimeout: config.ssh.readyTimeout,
    keepaliveInterval: config.ssh.keepaliveInterval,
    algorithms,
    ...optionalCreds
  }

  debug('Built SSH config:', {
    host: sshConfig.host,
    port: sshConfig.port,
    username: sshConfig.username,
    hasPassword: 'password' in sshConfig,
    hasPrivateKey: 'privateKey' in sshConfig,
    hasAlgorithms: 'algorithms' in sshConfig
  })

  return sshConfig
}

export class ServiceSocketAdapter {
  private sessionId: SessionId | null = null
  private connectionId: string | null = null
  private shellStream: SSH2Stream | null = null
  private readonly initialTermSettings: { term?: string; rows?: number; cols?: number } = {}
  private storedPassword: string | null = null

  constructor(
    private readonly socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    private readonly config: Config,
    private readonly services: Services,
    private readonly store: SessionStore
  ) {
    this.setupEventHandlers()
    // Request authentication from the client
    this.requestAuthentication()
  }

  private requestAuthentication(): void {
    debug(`Requesting authentication from client ${this.socket.id}`)
    this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, { action: 'request_auth' })
  }

  private setupEventHandlers(): void {
    debug(`Setting up event handlers for socket ${this.socket.id}`)

    // Log all incoming events for debugging (with sensitive data masked)
    this.socket.onAny((event, ...args) => {
      // Mask sensitive data in authenticate events
      if (event === SOCKET_EVENTS.AUTH && args.length > 0) {
        const authData = args[0] as AuthCredentials
        const maskedArgs = [{
          ...authData,
          password: authData.password !== undefined && authData.password !== '' ? '***MASKED***' : '',
          privateKey: authData.privateKey !== undefined && authData.privateKey !== '' ? '***MASKED***' : '',
          passphrase: authData.passphrase !== undefined && authData.passphrase !== '' ? '***MASKED***' : ''
        }]
        debug(`Received event '${event}' with args:`, maskedArgs)
      } else {
        debug(`Received event '${event}' with args:`, args)
      }
    })

    // Handle authentication
    this.socket.on(SOCKET_EVENTS.AUTH, async (credentials: AuthCredentials) => {
      debug(`Received AUTH event (${SOCKET_EVENTS.AUTH})`)
      await this.handleAuthentication(credentials)
    })

    // Handle terminal setup
    this.socket.on(SOCKET_EVENTS.TERMINAL, async (settings: TerminalSettings) => {
      debug(`Received TERMINAL event (${SOCKET_EVENTS.TERMINAL})`)
      await this.handleTerminal(settings)
    })

    // Handle resize
    this.socket.on(SOCKET_EVENTS.RESIZE, (dimensions: { rows: number; cols: number }) => {
      debug(`Received RESIZE event (${SOCKET_EVENTS.RESIZE})`)
      this.handleResize(dimensions)
    })

    // Handle data from client
    this.socket.on(SOCKET_EVENTS.DATA, (data: string) => {
      debug(`Received DATA event (${SOCKET_EVENTS.DATA})`)
      this.handleData(data)
    })

    // Handle exec
    this.socket.on(SOCKET_EVENTS.EXEC, (request: unknown) => {
      debug(`Received EXEC event (${SOCKET_EVENTS.EXEC})`)
      void this.handleExec(request)
    })

    // Handle control messages
    this.socket.on(SOCKET_EVENTS.CONTROL, (message: string) => {
      debug(`Received CONTROL event (${SOCKET_EVENTS.CONTROL}):`, message)
      this.handleControl(message)
    })

    // Handle disconnect
    this.socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      debug(`Received DISCONNECT event (${SOCKET_EVENTS.DISCONNECT})`)
      this.handleDisconnect()
    })
  }

  private async handleAuthentication(credentials: AuthCredentials): Promise<void> {
    try {
      debug('Authenticating user:', credentials.username)

      // Store terminal settings from auth credentials for later use
      if (credentials.term !== undefined) {
        this.initialTermSettings.term = credentials.term
      }
      if (credentials.rows !== undefined) {
        this.initialTermSettings.rows = credentials.rows
      }
      if (credentials.cols !== undefined) {
        this.initialTermSettings.cols = credentials.cols
      }
      debug('Stored initial terminal settings:', this.initialTermSettings)

      // Store password for credential replay if enabled
      if (this.config.options.allowReplay && credentials.password !== undefined && credentials.password !== '') {
        this.storedPassword = credentials.password
        debug('Stored password for credential replay')
      }

      // Authenticate using auth service
      const authCreds = buildAuthCredentials(credentials)
      const authResult = await this.services.auth.authenticate(authCreds)

      if (!authResult.ok) {
        this.socket.emit(SOCKET_EVENTS.SSH_ERROR, authResult.error.message)
        return
      }

      this.sessionId = authResult.value.sessionId

      // Connect SSH using SSH service
      const sshConfig = buildSSHConfig(credentials, this.sessionId, this.config)
      const sshResult = await this.services.ssh.connect(sshConfig)

      if (!sshResult.ok) {
        this.socket.emit(SOCKET_EVENTS.SSH_ERROR, sshResult.error.message)
        return
      }

      this.connectionId = sshResult.value.id as string
      this.emitAuthenticationSuccess(credentials)

      debug('Authentication successful')
    } catch (error) {
      const message = error instanceof Error ? error.message : VALIDATION_MESSAGES.AUTHENTICATION_FAILED
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, message)
      debug('Authentication error:', error)
    }
  }

  private emitAuthenticationSuccess(credentials: AuthCredentials): void {
    this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, { action: 'auth_result', success: true })
    this.socket.emit(SOCKET_EVENTS.PERMISSIONS, {
      autoLog: this.config.options.autoLog,
      allowReplay: this.config.options.allowReplay,
      allowReconnect: this.config.options.allowReconnect,
      allowReauth: this.config.options.allowReauth
    })
    this.socket.emit(SOCKET_EVENTS.GET_TERMINAL, true)

    const connectionString = `ssh://${credentials.username}@${credentials.host}:${credentials.port}`
    this.socket.emit(SOCKET_EVENTS.UPDATE_UI, { element: 'footer', value: connectionString })
  }

  private async handleTerminal(settings: TerminalSettings): Promise<void> {
    try {
      if (!this.validateSession()) {
        return
      }

      const terminalConfig = this.buildTerminalConfig(settings)

      if (!this.createTerminal(terminalConfig)) {
        return
      }

      const shellResult = await this.openShell(terminalConfig)
      if (shellResult === null) {
        return
      }

      this.setupShellDataFlow(shellResult)
      debug('Terminal created successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terminal setup failed'
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, message)
      debug('Terminal error:', error)
    }
  }

  private validateSession(): boolean {
    if (this.sessionId === null || this.connectionId === null) {
      debug('No session or connection for terminal')
      return false
    }
    return true
  }

  private buildTerminalConfig(settings: TerminalSettings): {
    sessionId: SessionId
    term: string
    rows: number
    cols: number
    env: Record<string, string>
  } {
    // Use settings from terminal event, fall back to initial settings from auth, then defaults
    return {
      sessionId: this.sessionId as SessionId,
      term: settings.term ?? this.initialTermSettings.term ?? TERMINAL_DEFAULTS.DEFAULT_TERM,
      rows: settings.rows ?? this.initialTermSettings.rows ?? TERMINAL_DEFAULTS.DEFAULT_ROWS,
      cols: settings.cols ?? this.initialTermSettings.cols ?? TERMINAL_DEFAULTS.DEFAULT_COLS,
      env: {}
    }
  }

  private createTerminal(config: {
    sessionId: SessionId
    term: string
    rows: number
    cols: number
    env: Record<string, string>
  }): boolean {
    const terminalResult = this.services.terminal.create(config)

    if (!terminalResult.ok) {
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, terminalResult.error.message)
      return false
    }
    return true
  }

  private async openShell(config: { term: string; rows: number; cols: number }): Promise<Duplex | null> {
    debug('Opening shell with config:', {
      term: config.term,
      rows: config.rows,
      cols: config.cols
    })

    const shellResult = await this.services.ssh.shell(
      createConnectionId(this.connectionId as string),
      {
        term: config.term,
        rows: config.rows,
        cols: config.cols,
        env: {}
      }
    )

    if (!shellResult.ok) {
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, shellResult.error.message)
      return null
    }
    return shellResult.value
  }

  private setupShellDataFlow(stream: Duplex): void {
    this.shellStream = stream

    this.shellStream.on('data', (chunk: Buffer) => {
      this.socket.emit(SOCKET_EVENTS.SSH_DATA, chunk.toString('utf8'))
    })

    this.shellStream.on('close', () => {
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, VALIDATION_MESSAGES.CONNECTION_CLOSED)
      this.socket.disconnect()
    })
  }

  private handleResize(dimensions: { rows: number; cols: number }): void {
    if (this.sessionId === null) {return}

    const result = this.services.terminal.resize(this.sessionId, dimensions)
    if (!result.ok) {
      debug('Resize failed:', result.error)
    }

    // Also resize the SSH stream if it supports it
    if (this.shellStream?.setWindow !== undefined) {
      this.shellStream.setWindow(dimensions.rows, dimensions.cols)
    }
  }

  private handleData(data: string): void {
    if (this.shellStream !== null) {
      this.shellStream.write(data)
    }
  }

  private async handleExec(request: unknown): Promise<void> {
    if (this.connectionId === null) {
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, VALIDATION_MESSAGES.NO_SSH_CONNECTION)
      return
    }

    try {
      const result = await this.services.ssh.exec(
        createConnectionId(this.connectionId),
        (request as { command: string }).command
      )

      if (result.ok) {
        this.socket.emit(SOCKET_EVENTS.SSH_DATA, result.value.stdout)
        if (result.value.stderr !== '') {
          this.socket.emit(SOCKET_EVENTS.SSH_DATA, result.value.stderr)
        }
      } else {
        this.socket.emit(SOCKET_EVENTS.SSH_ERROR, result.error.message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Exec failed'
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, message)
    }
  }

  private handleControl(message: string): void {
    switch (message) {
      case 'replayCredentials':
        this.handleReplayCredentials()
        break
      case 'reauth':
        this.handleReauth()
        break
      default:
        debug('Unknown control message:', message)
        break
    }
  }

  private handleReplayCredentials(): void {
    // Check if replay is allowed
    if (!this.config.options.allowReplay) {
      debug('Credential replay not permitted by configuration')
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'Credential replay not permitted')
      return
    }

    // Check if we have a password and shell stream
    if (this.storedPassword === null) {
      debug('No stored password for credential replay')
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'No stored password available')
      return
    }

    if (this.shellStream === null) {
      debug('No active shell for credential replay')
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'No active shell')
      return
    }

    // Prepare the password with appropriate line ending
    const lineEnding = this.config.options.replayCRLF === true ? '\r\n' : '\n'
    const passwordToSend = this.storedPassword + lineEnding

    // Send password to shell
    try {
      this.shellStream.write(passwordToSend)
      debug('Credential replay completed')
      // Log for audit (without exposing password)
      console.info(`[replayCredentials] socket=${this.socket.id} crlf=${this.config.options.replayCRLF === true ? '1' : '0'}`)
    } catch (error) {
      debug('Failed to replay credentials:', error)
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'Failed to replay credentials')
    }
  }

  private handleReauth(): void {
    if (this.config.options.allowReauth) {
      debug('Requesting re-authentication')
      this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, { action: 'reauth' })
    } else {
      debug('Re-authentication not permitted')
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'Re-authentication not permitted')
    }
  }

  private handleDisconnect(): void {
    debug('Client disconnected')

    // Clean up resources
    if (this.connectionId !== null) {
      void this.services.ssh.disconnect(createConnectionId(this.connectionId))
    }

    if (this.sessionId !== null) {
      this.services.terminal.destroy(this.sessionId)
      this.services.session.delete(this.sessionId)
    }

    // Clear stored password on disconnect
    this.storedPassword = null
    this.shellStream = null
    this.connectionId = null
    this.sessionId = null
  }
}