/**
 * Socket adapter that wires service-backed handlers to Socket.IO events
 */

import type { Socket } from 'socket.io'
import type { Services } from '../../services/interfaces.js'
import type { Config } from '../../types/config.js'
import { UnifiedAuthPipeline } from '../../auth/auth-pipeline.js'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  AuthCredentials,
  TerminalSettings
} from '../../types/contracts/v1/socket.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import { createNamespacedDebug } from '../../logger.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from './service-socket-shared.js'
import { ServiceSocketAuthentication } from './service-socket-authentication.js'
import { ServiceSocketTerminal } from './service-socket-terminal.js'
import { ServiceSocketControl } from './service-socket-control.js'

const debug = createNamespacedDebug('socket:service-adapter')

export class ServiceSocketAdapter {
  private readonly authPipeline: UnifiedAuthPipeline
  private readonly context: AdapterContext
  private readonly auth: ServiceSocketAuthentication
  private readonly terminal: ServiceSocketTerminal
  private readonly control: ServiceSocketControl

  constructor(
    private readonly socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    private readonly config: Config,
    private readonly services: Services
  ) {
    this.authPipeline = new UnifiedAuthPipeline(socket.request, config)

    this.context = {
      socket,
      config,
      services,
      authPipeline: this.authPipeline,
      state: createAdapterSharedState(),
      debug
    }

    this.auth = new ServiceSocketAuthentication(this.context)
    this.terminal = new ServiceSocketTerminal(this.context)
    this.control = new ServiceSocketControl(this.context)

    this.setupEventHandlers()
    this.auth.checkInitialAuth()
  }

  private setupEventHandlers(): void {
    this.socket.onAny((event, ...args) => {
      if (event === SOCKET_EVENTS.AUTH && args.length > 0) {
        const authData = args[0] as AuthCredentials
        const maskedArgs = [{
          ...authData,
          password: authData.password !== undefined && authData.password !== '' ? '***MASKED***' : '',
          privateKey: authData.privateKey !== undefined && authData.privateKey !== '' ? '***MASKED***' : '',
          passphrase: authData.passphrase !== undefined && authData.passphrase !== '' ? '***MASKED***' : ''
        }]
        debug(`Received event '${event}' with args:`, maskedArgs)
        return
      }

      debug(`Received event '${event}' with args:`, args)
    })

    this.socket.on(SOCKET_EVENTS.AUTH, async (credentials: AuthCredentials | { responses: string[] }) => {
      if ('responses' in credentials) {
        await this.auth.handleKeyboardInteractiveResponse(credentials.responses)
        return
      }

      await this.auth.handleAuthentication(credentials)
    })

    this.socket.on(SOCKET_EVENTS.TERMINAL, async (settings: TerminalSettings) => {
      await this.terminal.handleTerminal(settings)
    })

    this.socket.on(SOCKET_EVENTS.RESIZE, dimensions => {
      this.terminal.handleResize(dimensions)
    })

    this.socket.on(SOCKET_EVENTS.DATA, data => {
      this.terminal.handleData(data)
    })

    this.socket.on(SOCKET_EVENTS.EXEC, request => {
      void this.terminal.handleExec(request)
    })

    this.socket.on(SOCKET_EVENTS.CONTROL, message => {
      this.control.handleControl(message)
    })

    this.socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      this.control.handleDisconnect()
    })
  }
}
