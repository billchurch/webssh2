/**
 * Socket adapter that uses event bus for all operations
 * Bridges Socket.IO events to the application event bus
 */

import type { Socket } from 'socket.io'
import type { EventBus } from '../../events/event-bus.js'
import type { SessionStore } from '../../state/store.js'
import type { Config } from '../../types/config.js'
import type { SessionId, ConnectionId } from '../../types/branded.js'
import { createSessionId } from '../../types/branded.js'
import type { Duplex } from 'node:stream'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import { TERMINAL_DEFAULTS } from '../../constants/terminal.js'
import { EventPriority } from '../../events/types.js'

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

const debug = createNamespacedDebug('socket:event-adapter')

/**
 * Event-driven socket adapter
 * Translates between Socket.IO events and application event bus
 */
export class EventSocketAdapter {
  private readonly sessionId: SessionId
  private connectionId: ConnectionId | null = null
  private shellStream: SSH2Stream | null = null
  private unsubscribers: Array<() => void> = []

  constructor(
    private readonly socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    private readonly config: Config,
    private readonly eventBus: EventBus,
    private readonly store: SessionStore
  ) {
    // Generate session ID for this socket connection
    this.sessionId = createSessionId(socket.id)

    this.setupSocketListeners()
    this.setupEventListeners()
  }

  /**
   * Setup Socket.IO event listeners
   * Translates socket events to application events
   */
  private setupSocketListeners(): void {
    // Handle authentication
    this.socket.on(SOCKET_EVENTS.AUTH, async (credentials: AuthCredentials) => {
      debug('Received auth request from socket %s', this.socket.id)

      const authPayload: {
        sessionId: SessionId
        method: 'key' | 'password'
        username: string
        host: string
        port: number
        password?: string
        privateKey?: string
        passphrase?: string
      } = {
        sessionId: this.sessionId,
        method: credentials.privateKey !== undefined && credentials.privateKey !== '' ? 'key' : 'password',
        username: credentials.username,
        host: credentials.host,
        port: credentials.port
      }

      // Only include defined optional fields
      if (credentials.password !== undefined) {
        authPayload.password = credentials.password
      }
      if (credentials.privateKey !== undefined) {
        authPayload.privateKey = credentials.privateKey
      }
      if (credentials.passphrase !== undefined) {
        authPayload.passphrase = credentials.passphrase
      }

      await this.eventBus.publish({
        type: 'auth.request',
        payload: authPayload
      }, EventPriority.HIGH)
    })

    // Handle terminal setup
    this.socket.on(SOCKET_EVENTS.TERMINAL, async (settings: TerminalSettings) => {
      debug('Received terminal request from socket %s', this.socket.id)

      const terminalPayload = {
        sessionId: this.sessionId,
        term: settings.term ?? TERMINAL_DEFAULTS.TERM,
        rows: settings.rows ?? TERMINAL_DEFAULTS.ROWS,
        cols: settings.cols ?? TERMINAL_DEFAULTS.COLS,
        cwd: settings.cwd ?? null,
        env: settings.env ?? {}
      }

      await this.eventBus.publish({
        type: 'terminal.create' as const,
        payload: terminalPayload
      }, EventPriority.NORMAL)
    })

    // Handle resize
    this.socket.on(SOCKET_EVENTS.RESIZE, async (dimensions: { rows: number; cols: number }) => {
      debug('Received resize from socket %s: %dx%d', this.socket.id, dimensions.cols, dimensions.rows)

      await this.eventBus.publish({
        type: 'terminal.resize',
        payload: {
          sessionId: this.sessionId,
          rows: dimensions.rows,
          cols: dimensions.cols
        }
      }, EventPriority.LOW)
    })

    // Handle data from client
    this.socket.on(SOCKET_EVENTS.DATA, async (data: string) => {
      debug('Received data from socket %s: %d bytes', this.socket.id, data.length)

      await this.eventBus.publish({
        type: 'terminal.input',
        payload: {
          sessionId: this.sessionId,
          data
        }
      }, EventPriority.NORMAL)
    })

    // Handle exec
    this.socket.on(SOCKET_EVENTS.EXEC, async (request: unknown) => {
      debug('Received exec from socket %s', this.socket.id)

      if (typeof request === 'object' && request !== null && 'command' in request) {
        const { command } = request as { command: string }

        await this.eventBus.publish({
          type: 'terminal.command',
          payload: {
            sessionId: this.sessionId,
            command
          }
        }, EventPriority.HIGH)
      }
    })

    // Handle disconnect
    this.socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      debug('Socket %s disconnected', this.socket.id)

      await this.eventBus.publish({
        type: 'connection.closed',
        payload: {
          sessionId: this.sessionId,
          reason: 'Socket disconnected'
        }
      }, EventPriority.HIGH)

      this.cleanup()
    })
  }

  /**
   * Setup event bus listeners
   * Translates application events to socket events
   */
  private setupEventListeners(): void {
    // Listen for auth success
    const authSuccessUnsub = this.eventBus.subscribe('auth.success', (event) => {
      if (event.payload.sessionId !== this.sessionId) {
        return
      }

      debug('Auth success for session %s', this.sessionId)

      // Update store with connection info
      this.store.dispatch(this.sessionId, {
        type: 'AUTH_SUCCESS',
        payload: {
          username: event.payload.username,
          method: event.payload.method,
          userId: event.payload.userId
        }
      })

      // Emit success to client
      this.socket.emit(SOCKET_EVENTS.AUTHENTICATION, {
        action: 'auth_result',
        success: true,
        message: `Authenticated as ${event.payload.username}`
      })

      // Request connection
      void this.eventBus.publish({
        type: 'connection.request',
        payload: {
          sessionId: this.sessionId,
          host: this.config.ssh.host ?? 'localhost',
          port: this.config.ssh.port,
          username: event.payload.username
        }
      }, EventPriority.HIGH)
    })
    this.unsubscribers.push(authSuccessUnsub)

    // Listen for auth failure
    const authFailureUnsub = this.eventBus.subscribe('auth.failure', (event) => {
      if (event.payload.sessionId !== this.sessionId) {
        return
      }

      debug('Auth failure for session %s: %s', this.sessionId, event.payload.reason)

      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, event.payload.reason)
    })
    this.unsubscribers.push(authFailureUnsub)

    // Listen for connection established
    const connEstablishedUnsub = this.eventBus.subscribe('connection.established', (event) => {
      if (event.payload.sessionId !== this.sessionId) {
        return
      }

      debug('Connection established for session %s', this.sessionId)

      this.connectionId = event.payload.connectionId

      // Update store
      this.store.dispatch(this.sessionId, {
        type: 'CONNECTION_ESTABLISHED',
        payload: {
          connectionId: event.payload.connectionId
        }
      })
    })
    this.unsubscribers.push(connEstablishedUnsub)

    // Listen for connection error
    const connErrorUnsub = this.eventBus.subscribe('connection.error', (event) => {
      if (event.payload.sessionId !== this.sessionId) {
        return
      }

      debug('Connection error for session %s: %s', this.sessionId, event.payload.error)

      const errorMessage: string = event.payload.error
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, errorMessage)
    })
    this.unsubscribers.push(connErrorUnsub)

    // Listen for terminal output
    const terminalOutputUnsub = this.eventBus.subscribe('terminal.output', (event) => {
      if (event.payload.sessionId !== this.sessionId) {
        return
      }

      // Send data to client
      const outputData = event.payload.data
      this.socket.emit(SOCKET_EVENTS.DATA, outputData)
    })
    this.unsubscribers.push(terminalOutputUnsub)

    // Listen for terminal ready
    const terminalReadyUnsub = this.eventBus.subscribe('terminal.ready', (event) => {
      if (event.payload.sessionId !== this.sessionId) {
        return
      }

      debug('Terminal ready for session %s', this.sessionId)

      // Store stream for resize operations
      if ('stream' in event.payload) {
        this.shellStream = event.payload.stream as SSH2Stream
      }

      // Notify client that terminal is ready
      this.socket.emit(SOCKET_EVENTS.DATA, '\r\n*** SSH CONNECTION ESTABLISHED ***\r\n')
    })
    this.unsubscribers.push(terminalReadyUnsub)

    // Listen for terminal error
    const terminalErrorUnsub = this.eventBus.subscribe('terminal.error', (event) => {
      if (event.payload.sessionId !== this.sessionId) {
        return
      }

      debug('Terminal error for session %s: %s', this.sessionId, event.payload.error)

      const termErrorMessage = event.payload.error
      this.socket.emit(SOCKET_EVENTS.SSH_ERROR, termErrorMessage)
    })
    this.unsubscribers.push(terminalErrorUnsub)

    // Listen for exec result
    const execResultUnsub = this.eventBus.subscribe('exec.result', (event) => {
      if (event.payload.sessionId !== this.sessionId) {
        return
      }

      debug('Exec result for session %s', this.sessionId)

      // Send exec result to client
      const exitCode = event.payload.code
      this.socket.emit('exec-exit', {
        code: exitCode,
        signal: null
      })

      // Send stdout/stderr data
      const stdoutData = event.payload.stdout
      const stderrData = event.payload.stderr

      if (stdoutData !== '') {
        this.socket.emit('exec-data', {
          type: 'stdout',
          data: stdoutData
        })
      }
      if (stderrData !== '') {
        this.socket.emit('exec-data', {
          type: 'stderr',
          data: stderrData
        })
      }
    })
    this.unsubscribers.push(execResultUnsub)
  }

  /**
   * Cleanup event listeners and resources
   */
  private cleanup(): void {
    debug('Cleaning up socket adapter for session %s', this.sessionId)

    // Unsubscribe from all events
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe()
    }
    this.unsubscribers = []

    // Clean up stream
    if (this.shellStream !== null) {
      this.shellStream.destroy()
      this.shellStream = null
    }

    // Update store
    this.store.dispatch(this.sessionId, {
      type: 'SESSION_END'
    })
  }

  /**
   * Get the session ID for this adapter
   */
  getSessionId(): SessionId {
    return this.sessionId
  }

  /**
   * Get the connection ID if connected
   */
  getConnectionId(): ConnectionId | null {
    return this.connectionId
  }
}