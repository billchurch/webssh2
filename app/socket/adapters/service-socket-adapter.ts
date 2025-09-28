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
import { UnifiedAuthPipeline } from '../../auth/auth-pipeline.js'
import type { AuthMethod } from '../../auth/providers/auth-provider.interface.js'
import type { Credentials } from '../../validation/credentials.js'

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
  private readonly authPipeline: UnifiedAuthPipeline
  private originalAuthMethod: AuthMethod | null = null

  constructor(
    private readonly socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    private readonly config: Config,
    private readonly services: Services,
    private readonly store: SessionStore
  ) {
    // Initialize auth pipeline
    this.authPipeline = new UnifiedAuthPipeline(socket.request, config)

    this.setupEventHandlers()

    // Check authentication state on connection
    this.checkInitialAuth()
  }

  private checkInitialAuth(): void {
    debug(`Checking initial auth state for client ${this.socket.id}`)

    if (this.authPipeline.isAuthenticated()) {
      const creds = this.authPipeline.getCredentials()
      if (creds !== null) {
        // Store original auth method for tracking
        this.originalAuthMethod = this.authPipeline.getAuthMethod()
        debug(`Client already authenticated via ${this.originalAuthMethod}, auto-connecting`)

        // Auto-connect with existing credentials
        void this.handleAuthentication(creds as AuthCredentials)
      }
    } else if (this.authPipeline.requiresAuthRequest()) {
      // Check if interactive auth is allowed
      if (this.config.ssh.alwaysSendKeyboardInteractivePrompts === true) {
        this.requestKeyboardInteractiveAuth()
      } else {
        this.requestAuthentication()
      }
    } else {
      // Default to requesting auth
      this.requestAuthentication()
    }
  }

  private requestAuthentication(): void {
    const authMethod = this.authPipeline.getAuthMethod()
    debug(`Requesting authentication from client ${this.socket.id}, method: ${authMethod ?? 'manual'}`)

    this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, { action: 'request_auth' })
  }

  private requestKeyboardInteractiveAuth(): void {
    debug(`Requesting keyboard-interactive auth from client ${this.socket.id}`)

    // Emit keyboard-interactive event with prompts
    this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, {
      action: 'keyboard-interactive',
      prompts: [
        { prompt: 'Username: ', echo: true },
        { prompt: 'Password: ', echo: false }
      ],
      name: 'SSH Authentication',
      instructions: 'Please provide your credentials'
    })
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

    // Handle authentication - covers both regular auth and keyboard-interactive responses
    this.socket.on(SOCKET_EVENTS.AUTH, async (credentials: AuthCredentials | { responses: string[] }) => {
      debug(`Received AUTH event (${SOCKET_EVENTS.AUTH})`)

      // Check if this is a keyboard-interactive response
      if ('responses' in credentials) {
        await this.handleKeyboardInteractiveResponse(credentials.responses)
      } else {
        await this.handleAuthentication(credentials)
      }
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

  private async handleKeyboardInteractiveResponse(responses: string[]): Promise<void> {
    if (responses.length >= 2 && responses[0] !== undefined && responses[1] !== undefined) {
      // Check if host is configured
      if (this.config.ssh.host === null) {
        this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, {
          action: 'auth_result',
          success: false,
          message: 'No SSH host configured'
        })
        return
      }

      const credentials: AuthCredentials = {
        username: responses[0],
        password: responses[1],
        host: this.config.ssh.host,
        port: this.config.ssh.port
      }

      await this.handleAuthentication(credentials)
    } else {
      this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, {
        action: 'auth_result',
        success: false,
        message: 'Invalid authentication response'
      })
    }
  }

  private async handleAuthentication(credentials: AuthCredentials): Promise<void> {
    try {
      debug('Authenticating user:', credentials.username)
      this.originalAuthMethod ??= this.authPipeline.getAuthMethod()

      // Step 1: Update pipeline with credentials
      if (!this.updateAuthPipeline(credentials)) {
        return
      }

      // Step 2: Get and validate credentials
      const validatedCreds = this.authPipeline.getCredentials()
      if (!this.validateCredentials(validatedCreds)) {
        return
      }

      // Step 3: Store settings for later use
      this.storeTerminalSettings(credentials)
      this.storePasswordIfEnabled(validatedCreds)

      // Step 4: Build auth credentials
      const authCredentials = this.buildAuthCredentials(validatedCreds, credentials)

      // Step 5: Perform authentication
      const authResult = await this.performAuthentication(authCredentials)
      if (authResult === null) {
        return
      }

      // Step 6: Connect SSH
      const sshResult = await this.connectSSH(authCredentials, authResult.sessionId)
      if (sshResult === null) {
        return
      }

      // Step 7: Finalize successful authentication
      this.connectionId = sshResult.id
      this.sessionId = authResult.sessionId
      this.emitAuthenticationSuccess(authCredentials)

      debug(`Authentication successful via ${this.originalAuthMethod ?? 'manual'}`)
      console.info(`[auth] socket=${this.socket.id} method=${this.originalAuthMethod ?? 'manual'}`)
    } catch (error) {
      this.handleAuthenticationError(error)
    }
  }

  private updateAuthPipeline(credentials: AuthCredentials): boolean {
    if (Object.keys(credentials).length === 0) {
      return true
    }

    const pipelineCredentials = {
      username: credentials.username,
      password: credentials.password,
      host: credentials.host,
      port: credentials.port
    }

    if (!this.authPipeline.setManualCredentials(pipelineCredentials)) {
      this.emitAuthenticationFailure('Invalid credentials')
      return false
    }

    return true
  }

  private validateCredentials(validatedCreds: Credentials | null): validatedCreds is Credentials {
    if (validatedCreds === null) {
      this.emitAuthenticationFailure('No credentials available')
      return false
    }
    return true
  }

  private storeTerminalSettings(credentials: AuthCredentials): void {
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
  }

  private storePasswordIfEnabled(validatedCreds: Credentials): void {
    if (this.config.options.allowReplay &&
        typeof validatedCreds.password === 'string' &&
        validatedCreds.password !== '') {
      this.storedPassword = validatedCreds.password
      debug('Stored password for credential replay')
    }
  }

  private buildAuthCredentials(validatedCreds: Credentials, credentials: AuthCredentials): AuthCredentials {
    const authCredentials: AuthCredentials = {
      username: validatedCreds.username ?? credentials.username,
      host: validatedCreds.host ?? credentials.host,
      port: validatedCreds.port ?? credentials.port
    }

    if (validatedCreds.password !== undefined) {
      authCredentials.password = validatedCreds.password
    }
    if (validatedCreds.privateKey !== undefined) {
      authCredentials.privateKey = validatedCreds.privateKey
    }
    if (validatedCreds.passphrase !== undefined) {
      authCredentials.passphrase = validatedCreds.passphrase
    }

    return authCredentials
  }

  private async performAuthentication(authCredentials: AuthCredentials): Promise<{ sessionId: SessionId } | null> {
    const authResult = await this.services.auth.authenticate(authCredentials)

    if (authResult.ok) {
      return authResult.value
    } else {
      const errorMessage = this.normalizeAuthError(authResult.error.message)
      this.emitAuthenticationFailure(errorMessage)
      return null
    }
  }

  private normalizeAuthError(message: string): string {
    if (message.includes('Invalid credentials format') ||
        message.includes('Username is required') ||
        message.includes('No authentication method provided')) {
      return 'Invalid credentials'
    }
    return message
  }

  private async connectSSH(
    authCredentials: AuthCredentials,
    sessionId: SessionId
  ): Promise<{ id: string } | null> {
    const sshConfig = buildSSHConfig(authCredentials, sessionId, this.config)
    const sshResult = await this.services.ssh.connect(sshConfig)

    if (sshResult.ok) {
      return sshResult.value
    } else {
      this.emitAuthenticationFailure(sshResult.error.message)
      return null
    }
  }

  private emitAuthenticationFailure(message: string): void {
    this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, {
      action: 'auth_result',
      success: false,
      message
    })
  }

  private handleAuthenticationError(error: unknown): void {
    const message = error instanceof Error ? error.message : VALIDATION_MESSAGES.AUTHENTICATION_FAILED
    this.emitAuthenticationFailure(message)
    debug('Authentication error:', error)
  }

  private emitAuthenticationSuccess(credentials: AuthCredentials): void {
    this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, {
      action: 'auth_result',
      success: true
    })
    this.socket.emit(SOCKET_EVENTS.PERMISSIONS, {
      autoLog: this.config.options.autoLog,
      allowReplay: this.config.options.allowReplay,
      allowReconnect: this.config.options.allowReconnect,
      allowReauth: this.config.options.allowReauth
    })
    this.socket.emit(SOCKET_EVENTS.GET_TERMINAL, true)

    // Emit connection string without username to match V1 behavior
    const connectionString = `ssh://${credentials.host}:${credentials.port}`
    this.socket.emit(SOCKET_EVENTS.UPDATE_UI, { element: 'footer', value: connectionString })

    // Emit Connected status that tests expect
    this.socket.emit(SOCKET_EVENTS.UPDATE_UI, { element: 'status', value: 'Connected' })
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
    // Get environment variables from session
    const req = this.socket.request as { session?: { envVars?: Record<string, string> } }
    const envVars = req.session?.envVars ?? {}

    // Use settings from terminal event, fall back to initial settings from auth, then defaults
    return {
      sessionId: this.sessionId as SessionId,
      term: settings.term ?? this.initialTermSettings.term ?? TERMINAL_DEFAULTS.DEFAULT_TERM,
      rows: settings.rows ?? this.initialTermSettings.rows ?? TERMINAL_DEFAULTS.DEFAULT_ROWS,
      cols: settings.cols ?? this.initialTermSettings.cols ?? TERMINAL_DEFAULTS.DEFAULT_COLS,
      env: envVars
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

    if (terminalResult.ok) {
      return true
    } else {
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, terminalResult.error.message)
      return false
    }
  }

  private async openShell(config: { term: string; rows: number; cols: number }): Promise<Duplex | null> {
    // Get environment variables from session
    const req = this.socket.request as { session?: { envVars?: Record<string, string> } }
    const envVars = req.session?.envVars ?? {}

    debug('Opening shell with config:', {
      term: config.term,
      rows: config.rows,
      cols: config.cols,
      hasEnv: Object.keys(envVars).length > 0
    })

    const shellResult = await this.services.ssh.shell(
      createConnectionId(this.connectionId as string),
      {
        term: config.term,
        rows: config.rows,
        cols: config.cols,
        env: envVars
      }
    )

    if (shellResult.ok) {
      return shellResult.value
    } else {
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, shellResult.error.message)
      return null
    }
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
    if (this.sessionId === null) {
      debug('Resize ignored: No session ID yet')
      return
    }

    // Check if terminal exists before attempting resize
    const terminalResult = this.services.terminal.getTerminal(this.sessionId)
    if (terminalResult.ok && terminalResult.value !== null) {
      const result = this.services.terminal.resize(this.sessionId, dimensions)
      if (result.ok) {
        // Resize successful
      } else {
        debug('Resize failed:', result.error)
      }
    } else {
      debug('Resize ignored: Terminal not created yet for session', this.sessionId)
      // Store dimensions for when terminal is created
      this.initialTermSettings.rows = dimensions.rows
      this.initialTermSettings.cols = dimensions.cols
      return
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