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
import { createNamespacedDebug, createAppStructuredLogger } from '../../logger.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from './service-socket-shared.js'
import { ServiceSocketAuthentication } from './service-socket-authentication.js'
import { ServiceSocketTerminal } from './service-socket-terminal.js'
import { ServiceSocketControl } from './service-socket-control.js'

const debug = createNamespacedDebug('socket:service-adapter')

interface SocketHandshakeLike {
  headers?: Record<string, string | string[]>
  address?: unknown
}

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

    const state = createAdapterSharedState()
    const clientDetails = extractClientDetails(socket)
    state.clientIp = clientDetails.ip
    state.clientPort = clientDetails.port

    this.context = {
      socket,
      config,
      services,
      authPipeline: this.authPipeline,
      state,
      debug,
      logger: createAppStructuredLogger({ namespace: 'webssh2:socket' })
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

function extractClientDetails(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): { ip: string | null; port: number | null } {
  const handshakeLike = (socket as unknown as { handshake?: SocketHandshakeLike }).handshake
  const headersRecord = handshakeLike?.headers ?? {}

  const forwardedFor = headersRecord['x-forwarded-for']
  const forwardedPort = headersRecord['x-forwarded-port']

  let ip = normaliseForwardedValue(forwardedFor)
  const fallbackAddress = typeof handshakeLike?.address === 'string' ? handshakeLike.address : null
  if (ip === null && fallbackAddress !== null) {
    ip = fallbackAddress
  }

  const port = parsePort(forwardedPort)

  return { ip, port }
}

function normaliseForwardedValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value !== '') {
    return value.split(',')[0]?.trim() ?? null
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0]?.split(',')[0]?.trim() ?? null
  }

  return null
}

function parsePort(value: string | string[] | undefined): number | null {
  let portString: string | undefined
  if (typeof value === 'string') {
    portString = value
  } else if (Array.isArray(value) && value.length > 0) {
    portString = value[0]
  }

  if (portString === undefined) {
    return null
  }

  const parsed = Number.parseInt(portString, 10)
  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535) {
    return parsed
  }

  return null
}
