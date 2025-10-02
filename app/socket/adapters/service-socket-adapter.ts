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
import { emitSocketLog } from '../../logging/socket-logger.js'

const debug = createNamespacedDebug('socket:service-adapter')

interface SocketHandshakeLike {
  headers?: Record<string, string | string[]>
  address?: unknown
}

type HeaderValue = string | string[] | undefined
type NullableString = string | null
type NullableNumber = number | null
type ClientDetails = {
  ip: NullableString
  port: NullableNumber
  userAgent: NullableString
  sourcePort: NullableNumber
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
    state.clientSourcePort = clientDetails.sourcePort
    state.userAgent = clientDetails.userAgent

    this.context = {
      socket,
      config,
      services,
      authPipeline: this.authPipeline,
      state,
      debug,
      logger: createAppStructuredLogger({ namespace: 'webssh2:socket', config })
    }

    this.auth = new ServiceSocketAuthentication(this.context)
    this.terminal = new ServiceSocketTerminal(this.context)
    this.control = new ServiceSocketControl(this.context)

    this.setupEventHandlers()
    this.logSessionInit()
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

  private logSessionInit(): void {
    emitSocketLog(this.context, 'info', 'session_init', 'Socket session initialised', {
      data: {
        allow_replay: this.context.config.options.allowReplay === true,
        allow_reauth: this.context.config.options.allowReauth === true,
        allow_reconnect: this.context.config.options.allowReconnect === true
      }
    })
  }
}

function extractClientDetails(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): ClientDetails {
  const handshakeLike = (socket as unknown as { handshake?: SocketHandshakeLike }).handshake
  const headersRecord = handshakeLike?.headers ?? {}

  const forwardedFor = headersRecord['x-forwarded-for']
  const forwardedPort = headersRecord['x-forwarded-port']
  const userAgentHeader = headersRecord['user-agent']

  let ip = normaliseForwardedValue(forwardedFor)
  const fallbackAddress = typeof handshakeLike?.address === 'string' ? handshakeLike.address : null
  if (ip === null && fallbackAddress !== null) {
    ip = fallbackAddress
  }

  const port = parsePort(forwardedPort)
  const sourcePort = parseSourcePort(socket.request as { connection?: { remotePort?: number | null } } | undefined, port)
  const userAgent = normaliseUserAgent(userAgentHeader)

  return { ip, port, userAgent, sourcePort }
}

function normaliseForwardedValue(value: HeaderValue): NullableString {
  if (typeof value === 'string' && value !== '') {
    return value.split(',')[0]?.trim() ?? null
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0]?.split(',')[0]?.trim() ?? null
  }

  return null
}

function parsePort(value: HeaderValue): NullableNumber {
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

function parseSourcePort(
  request: { connection?: { remotePort?: number | null } } | undefined,
  forwardedPort: number | null
): NullableNumber {
  if (forwardedPort !== null) {
    return forwardedPort
  }

  const remotePort = request?.connection?.remotePort ?? null
  return typeof remotePort === 'number' ? remotePort : null
}

function normaliseUserAgent(value: HeaderValue): NullableString {
  const MAX_LENGTH = 512

  let candidate: string | undefined
  if (typeof value === 'string') {
    candidate = value
  } else if (Array.isArray(value) && value.length > 0) {
    candidate = value[0]
  }

  if (candidate === undefined) {
    return null
  }

  const trimmed = candidate.trim()
  if (trimmed === '') {
    return null
  }

  return trimmed.length > MAX_LENGTH ? trimmed.slice(0, MAX_LENGTH) : trimmed
}
