import type { AuthCredentials } from '../../types/contracts/v1/socket.js'
import type { Credentials } from '../../validation/credentials.js'
import type { SessionId } from '../../types/branded.js'
import type { AdapterContext } from './service-socket-shared.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import { VALIDATION_MESSAGES } from '../../constants/validation.js'
import { buildSSHConfig } from './ssh-config.js'

export class ServiceSocketAuthentication {
  constructor(private readonly context: AdapterContext) {}

  checkInitialAuth(): void {
    const { authPipeline, socket, debug } = this.context

    debug(`Checking initial auth state for client ${socket.id}`)

    if (authPipeline.isAuthenticated()) {
      const creds = authPipeline.getCredentials()

      if (creds !== null) {
        this.context.state.originalAuthMethod = authPipeline.getAuthMethod()
        debug(`Client already authenticated via ${this.context.state.originalAuthMethod}, auto-connecting`)

        void this.handleAuthentication(creds as AuthCredentials)
      }

      return
    }

    if (authPipeline.requiresAuthRequest()) {
      if (this.context.config.ssh.alwaysSendKeyboardInteractivePrompts === true) {
        this.requestKeyboardInteractiveAuth()
      } else {
        this.requestAuthentication()
      }

      return
    }

    this.requestAuthentication()
  }

  requestAuthentication(): void {
    const method = this.context.authPipeline.getAuthMethod()
    this.context.debug(`Requesting authentication from client ${this.context.socket.id}, method: ${method ?? 'manual'}`)
    this.context.socket.emit(SOCKET_EVENTS.AUTHENTICATION, { action: 'request_auth' })
  }

  requestKeyboardInteractiveAuth(): void {
    this.context.debug(`Requesting keyboard-interactive auth from client ${this.context.socket.id}`)

    this.context.socket.emit(SOCKET_EVENTS.AUTHENTICATION, {
      action: 'keyboard-interactive',
      prompts: [
        { prompt: 'Username: ', echo: true },
        { prompt: 'Password: ', echo: false }
      ],
      name: 'SSH Authentication',
      instructions: 'Please provide your credentials'
    })
  }

  async handleKeyboardInteractiveResponse(responses: string[]): Promise<void> {
    if (responses.length < 2 || responses[0] === undefined || responses[1] === undefined) {
      this.emitAuthFailure('Invalid authentication response')
      return
    }

    if (this.context.config.ssh.host === null) {
      this.emitAuthFailure('No SSH host configured')
      return
    }

    const credentials: AuthCredentials = {
      username: responses[0],
      password: responses[1],
      host: this.context.config.ssh.host,
      port: this.context.config.ssh.port
    }

    await this.handleAuthentication(credentials)
  }

  async handleAuthentication(credentials: AuthCredentials): Promise<void> {
    try {
      this.initializeAuthAttempt(credentials)

      const authCredentials = this.prepareAuthCredentials(credentials)
      if (authCredentials === null) {
        return
      }

      const authResult = await this.performAuthentication(authCredentials)
      if (authResult === null) {
        return
      }

      const sshResult = await this.connectSSH(authCredentials, authResult.sessionId)
      if (sshResult === null) {
        return
      }

      this.finalizeAuthentication(authCredentials, authResult.sessionId, sshResult.id)
    } catch (error) {
      this.handleAuthenticationError(error)
    }
  }

  private initializeAuthAttempt(credentials: AuthCredentials): void {
    this.context.debug('Authenticating user:', credentials.username)
    this.context.state.originalAuthMethod ??= this.context.authPipeline.getAuthMethod()
  }

  private prepareAuthCredentials(credentials: AuthCredentials): AuthCredentials | null {
    if (!this.updateAuthPipeline(credentials)) {
      return null
    }

    const validatedCreds = this.context.authPipeline.getCredentials()

    if (!this.validateCredentials(validatedCreds)) {
      return null
    }

    this.storeTerminalSettings(credentials)
    this.storePasswordIfEnabled(validatedCreds)

    return this.buildAuthCredentials(validatedCreds, credentials)
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

    if (!this.context.authPipeline.setManualCredentials(pipelineCredentials)) {
      this.emitAuthFailure('Invalid credentials')
      return false
    }

    return true
  }

  private validateCredentials(validatedCreds: Credentials | null): validatedCreds is Credentials {
    if (validatedCreds === null) {
      this.emitAuthFailure('No credentials available')
      return false
    }

    return true
  }

  private storeTerminalSettings(credentials: AuthCredentials): void {
    const { initialTermSettings } = this.context.state

    if (credentials.term !== undefined) {
      initialTermSettings.term = credentials.term
    }

    if (credentials.rows !== undefined) {
      initialTermSettings.rows = credentials.rows
    }

    if (credentials.cols !== undefined) {
      initialTermSettings.cols = credentials.cols
    }

    this.context.debug('Stored initial terminal settings:', initialTermSettings)
  }

  private storePasswordIfEnabled(validatedCreds: Credentials): void {
    if (
      this.context.config.options.allowReplay &&
      typeof validatedCreds.password === 'string' &&
      validatedCreds.password !== ''
    ) {
      this.context.state.storedPassword = validatedCreds.password
      this.context.debug('Stored password for credential replay')
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

  private async performAuthentication(
    authCredentials: AuthCredentials
  ): Promise<{ sessionId: SessionId } | null> {
    const authResult = await this.context.services.auth.authenticate(authCredentials)

    if (authResult.ok) {
      return authResult.value
    }

    const errorMessage = this.normalizeAuthError(authResult.error.message)
    this.emitAuthFailure(errorMessage)
    return null
  }

  private normalizeAuthError(message: string): string {
    if (
      message.includes('Invalid credentials format') ||
      message.includes('Username is required') ||
      message.includes('No authentication method provided')
    ) {
      return 'Invalid credentials'
    }

    return message
  }

  private async connectSSH(
    authCredentials: AuthCredentials,
    sessionId: SessionId
  ): Promise<{ id: string } | null> {
    const sshConfig = buildSSHConfig(authCredentials, sessionId, this.context.config)
    const sshResult = await this.context.services.ssh.connect(sshConfig)

    if (sshResult.ok) {
      return sshResult.value
    }

    this.emitAuthFailure(sshResult.error.message)
    return null
  }

  private finalizeAuthentication(
    authCredentials: AuthCredentials,
    sessionId: SessionId,
    connectionId: string
  ): void {
    this.context.state.connectionId = connectionId
    this.context.state.sessionId = sessionId
    this.emitAuthSuccess(authCredentials)

    const method = this.context.state.originalAuthMethod ?? 'manual'
    this.context.debug(`Authentication successful via ${method}`)
    console.info(`[auth] socket=${this.context.socket.id} method=${method}`)
  }

  private emitAuthFailure(message: string): void {
    this.context.socket.emit(SOCKET_EVENTS.AUTHENTICATION, {
      action: 'auth_result',
      success: false,
      message
    })
  }

  private handleAuthenticationError(error: unknown): void {
    const message = error instanceof Error ? error.message : VALIDATION_MESSAGES.AUTHENTICATION_FAILED
    this.emitAuthFailure(message)
    this.context.debug('Authentication error:', error)
  }

  private emitAuthSuccess(credentials: AuthCredentials): void {
    const { socket, config } = this.context

    socket.emit(SOCKET_EVENTS.AUTHENTICATION, {
      action: 'auth_result',
      success: true
    })

    socket.emit(SOCKET_EVENTS.PERMISSIONS, {
      autoLog: config.options.autoLog,
      allowReplay: config.options.allowReplay,
      allowReconnect: config.options.allowReconnect,
      allowReauth: config.options.allowReauth
    })

    socket.emit(SOCKET_EVENTS.GET_TERMINAL, true)

    const connectionString = `ssh://${credentials.host}:${credentials.port}`
    socket.emit(SOCKET_EVENTS.UPDATE_UI, { element: 'footer', value: connectionString })
    socket.emit(SOCKET_EVENTS.UPDATE_UI, { element: 'status', value: 'Connected' })
  }
}
