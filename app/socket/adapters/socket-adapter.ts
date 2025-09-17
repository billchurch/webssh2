// app/socket/adapters/socket-adapter.ts
// I/O adapter for Socket.IO operations

import type { Socket } from 'socket.io'
import type { EventEmitter } from 'events'
import { createNamespacedDebug } from '../../logger.js'
import { UnifiedAuthPipeline } from '../../auth/auth-pipeline.js'
import {
  handleAuthRequest,
  createAuthResponse,
  requiresInteractiveAuth,
  createInitialSessionState,
  type SessionState,
} from '../handlers/auth-handler.js'
import {
  handleTerminalSetup,
  handleTerminalResize,
  type TerminalConfig,
  type TerminalState,
} from '../handlers/terminal-handler.js'
import {
  handleExecRequest,
  createExecDataPayload,
  createExecExitPayload,
} from '../handlers/exec-handler.js'
import type { Config } from '../../types/config.js'
import type { 
  ClientToServerEvents, 
  ServerToClientEvents,
  AuthCredentials,
  TerminalSettings,
} from '../../types/contracts/v1/socket.js'

const debug = createNamespacedDebug('socket:adapter')

export interface SocketHandlers {
  onAuth: (credentials: AuthCredentials, state: SessionState) => Promise<void>
  onTerminal: (settings: TerminalSettings, state: SessionState) => Promise<void>
  onExec: (payload: unknown, state: SessionState) => Promise<void>
  onResize: (size: { cols: number; rows: number }) => void
  onData: (chunk: string) => void
  onControl: (msg: string) => void
  onDisconnect: (reason: string) => void
}

interface ExtendedRequest {
  session?: {
    envVars?: Record<string, string>
    [key: string]: unknown
  }
}

/**
 * Socket.IO adapter that bridges between Socket events and pure handlers
 * Handles all I/O operations and state management
 */
export class SocketAdapter {
  private readonly socket: Socket<ClientToServerEvents, ServerToClientEvents>
  private readonly config: Config
  private readonly authPipeline: UnifiedAuthPipeline
  private sessionState: SessionState
  private readonly terminalConfig: TerminalConfig
  private terminalState: TerminalState | null = null
  private handlers: SocketHandlers | null = null
  private shellStream: EventEmitter | null = null
  private onClientData: ((chunk: string) => void) | null = null

  constructor(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    config: Config
  ) {
    this.socket = socket
    this.config = config
    this.authPipeline = new UnifiedAuthPipeline(socket.request, config)
    this.sessionState = createInitialSessionState()
    this.terminalConfig = {
      term: null,
      cols: null,
      rows: null,
    }

    this.initializeSocketEvents()
    this.checkInitialAuth()
  }

  /**
   * Sets the handlers for SSH operations
   */
  setHandlers(handlers: SocketHandlers): void {
    this.handlers = handlers
  }

  /**
   * Gets current session state
   */
  getSessionState(): SessionState {
    return { ...this.sessionState }
  }

  /**
   * Gets current terminal state
   */
  getTerminalState(): TerminalState | null {
    return this.terminalState
  }

  /**
   * Updates session state
   */
  updateSessionState(state: Partial<SessionState>): void {
    this.sessionState = { ...this.sessionState, ...state }
  }

  /**
   * Sets the shell stream for I/O
   */
  setShellStream(stream: EventEmitter): void {
    this.shellStream = stream
    this.setupShellStreamHandlers()
  }

  /**
   * Initialize socket event listeners
   */
  private initializeSocketEvents(): void {
    debug(`Socket connected: ${this.socket.id}`)

    this.socket.on('authenticate', (creds) => this.handleAuthenticate(creds))
    this.socket.on('terminal', (settings) => this.handleTerminal(settings))
    this.socket.on('exec', (payload) => this.handleExec(payload))
    this.socket.on('resize', (size) => this.handleResize(size))
    this.socket.on('data', (chunk) => this.handleData(chunk))
    this.socket.on('control', (msg) => this.handleControl(msg))
    this.socket.on('disconnect', (reason) => this.handleDisconnect(reason))
  }

  /**
   * Check for initial authentication
   */
  private checkInitialAuth(): void {
    if (this.authPipeline.isAuthenticated()) {
      const authMethod = this.authPipeline.getAuthMethod()
      const creds = this.authPipeline.getCredentials()
      
      debug(`Initial auth detected: ${authMethod}`)
      
      if (creds != null) {
        // Process with pure handler
        const result = handleAuthRequest(creds, this.sessionState, this.config)
        
        if (result.success && result.sessionState != null) {
          this.sessionState = result.sessionState
          if (result.credentials != null) {
            void this.handlers?.onAuth(result.credentials, this.sessionState)
          }
        }
      }
    } else if (requiresInteractiveAuth(this.sessionState, this.config)) {
      debug('Requesting interactive authentication')
      this.socket.emit('authentication', { action: 'request_auth' })
    }
  }

  /**
   * Handle authentication event
   */
  private handleAuthenticate(creds: AuthCredentials): void {
    debug(`Authentication attempt from ${this.socket.id}`)

    // Process with pure handler
    const result = handleAuthRequest(creds, this.sessionState, this.config)

    if (result.success) {
      if (result.sessionState != null) {
        this.sessionState = result.sessionState
      }
      
      if (result.credentials != null) {
        // Update auth pipeline
        this.authPipeline.setManualCredentials(result.credentials as unknown as Record<string, unknown>)
        
        // Call async handler
        void this.handlers?.onAuth(result.credentials, this.sessionState)
      }
    } else {
      const response = createAuthResponse(result)
      this.socket.emit('authentication', response)
    }
  }

  /**
   * Handle terminal settings
   */
  private handleTerminal(settings: TerminalSettings): void {
    debug(`Terminal settings from ${this.socket.id}`)

    // Process with pure handler
    const result = handleTerminalSetup(
      settings,
      this.terminalConfig,
      this.config
    )

    if (result.success && result.terminal != null) {
      this.terminalState = result.terminal
      
      // Update terminal config
      if (settings.term != null) {
        this.terminalConfig.term = settings.term
      }
      if (settings.cols != null) {
        this.terminalConfig.cols = settings.cols
      }
      if (settings.rows != null) {
        this.terminalConfig.rows = settings.rows
      }

      // Call async handler
      void this.handlers?.onTerminal(settings, this.sessionState)
    } else if (result.error != null) {
      this.socket.emit('ssherror', result.error)
    }
  }

  /**
   * Handle exec command
   */
  private handleExec(payload: unknown): void {
    debug(`Exec request from ${this.socket.id}`)

    const req = this.socket.request as ExtendedRequest
    const sessionEnv = req.session?.envVars

    // Process with pure handler
    const result = handleExecRequest(
      payload,
      this.sessionState.term,
      this.sessionState.cols,
      this.sessionState.rows,
      sessionEnv
    )

    if (result.success) {
      // Call async handler
      void this.handlers?.onExec(payload, this.sessionState)
    } else {
      this.socket.emit('ssherror', result.error ?? 'Exec request failed')
    }
  }

  /**
   * Handle terminal resize
   */
  private handleResize(size: { cols: number; rows: number }): void {
    const result = handleTerminalResize(size)
    
    if (result.success && result.cols != null && result.rows != null) {
      // Update state
      this.sessionState.cols = result.cols
      this.sessionState.rows = result.rows
      
      // Call handler
      this.handlers?.onResize(size)
    }
  }

  /**
   * Handle client data
   */
  private handleData(chunk: string): void {
    this.handlers?.onData(chunk)
  }

  /**
   * Handle control messages
   */
  private handleControl(msg: string): void {
    this.handlers?.onControl(msg)
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(reason: string): void {
    debug(`Socket disconnected: ${this.socket.id}, reason: ${reason}`)
    
    // Clean up client data handler
    if (this.onClientData != null) {
      this.socket.off('data', this.onClientData)
      this.onClientData = null
    }
    
    // Clean up shell stream
    if (this.shellStream != null) {
      this.shellStream.removeAllListeners()
      this.shellStream = null
    }
    
    // Call handler
    this.handlers?.onDisconnect(reason)
    
    // Disconnect socket
    this.socket.disconnect(true)
  }

  /**
   * Setup shell stream I/O handlers
   */
  private setupShellStreamHandlers(): void {
    if (this.shellStream == null) {
      return
    }

    // Forward shell output to client
    this.shellStream.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      this.socket.emit('data', text)
    })

    // Handle shell close
    this.shellStream.on('close', () => {
      debug('Shell stream closed')
      if (this.onClientData != null) {
        this.socket.off('data', this.onClientData)
        this.onClientData = null
      }
      this.shellStream = null
    })

    // Handle shell errors
    this.shellStream.on('error', (err: Error) => {
      debug(`Shell stream error: ${err.message}`)
      this.socket.emit('ssherror', `Shell error: ${err.message}`)
    })
  }

  /**
   * Setup exec stream I/O handlers
   */
  setupExecStreamHandlers(stream: EventEmitter & { stderr?: EventEmitter }): void {
    // Handle stdout
    stream.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      this.socket.emit('data', text)
      const payload = createExecDataPayload('stdout', text)
      this.socket.emit('exec-data', payload)
    })

    // Handle stderr
    if (stream.stderr != null && typeof stream.stderr.on === 'function') {
      stream.stderr.on('data', (data: Buffer) => {
        const text = data.toString('utf-8')
        const payload = createExecDataPayload('stderr', text)
        this.socket.emit('exec-data', payload)
      })
    }

    // Handle close
    stream.on('close', (code: unknown, signal: unknown) => {
      const safeCode = typeof code === 'number' ? code : null
      const safeSignal = typeof signal === 'string' ? signal : null
      const payload = createExecExitPayload(safeCode, safeSignal)
      this.socket.emit('exec-exit', payload)
    })

    // Handle errors
    stream.on('error', (err: Error) => {
      this.socket.emit('ssherror', `SSH exec error: ${err.message}`)
    })
  }

  /**
   * Emit authentication success
   */
  emitAuthSuccess(): void {
    this.socket.emit('authentication', {
      action: 'auth_result',
      success: true,
    })
  }

  /**
   * Emit authentication failure
   */
  emitAuthFailure(message: string): void {
    this.socket.emit('authentication', {
      action: 'auth_result',
      success: false,
      message,
    })
  }

  /**
   * Emit permissions
   */
  emitPermissions(): void {
    this.socket.emit('permissions', {
      autoLog: !!this.config.options.autoLog,
      allowReplay: !!this.config.options.allowReplay,
      allowReconnect: !!this.config.options.allowReconnect,
      allowReauth: !!this.config.options.allowReauth,
    })
  }

  /**
   * Emit UI update
   */
  emitUIUpdate(element: string, value: string): void {
    this.socket.emit('updateUI', { element, value })
  }

  /**
   * Emit terminal request
   */
  emitGetTerminal(open: boolean): void {
    this.socket.emit('getTerminal', open)
  }

  /**
   * Emit SSH error
   */
  emitError(message: string): void {
    this.socket.emit('ssherror', message)
  }
}