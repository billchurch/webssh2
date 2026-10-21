/**
 * Socket adapter that wires service-backed handlers to Socket.IO events
 */

import type { Socket } from 'socket.io'
import type { Services, ProtocolType } from '../../services/interfaces.js'
import type { Config } from '../../types/config.js'
import { UnifiedAuthPipeline } from '../../auth/auth-pipeline.js'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from '../../types/contracts/v1/socket.js'
import type { Result } from '../../types/result.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import { createNamespacedDebug, createAppStructuredLogger } from '../../logger.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from './service-socket-shared.js'
import { ServiceSocketAuthentication } from './service-socket-authentication.js'
import { ServiceSocketTerminal } from './service-socket-terminal.js'
import { ServiceSocketControl } from './service-socket-control.js'
import { ServiceSocketSftp } from './service-socket-sftp.js'
import { ServiceSocketPrompt } from './service-socket-prompt.js'
import { emitSocketLog } from '../../logging/socket-logger.js'
import {
  validateAuthenticateMessage,
  validateTerminalSettingsMessage,
  validateResizeMessage,
  validateDataMessage,
  validateExecRequestMessage,
  validateControlMessage
} from '../../validation/socket-messages.js'
import {
  registerGuardedListener,
  describeInboundEvent,
  acceptPayload,
  ignorePayload
} from './socket-event-guard.js'
import { validatePromptResponse } from '../handlers/prompt-validator.js'

const debug = createNamespacedDebug('socket:service-adapter')

type InboundEvent = keyof ClientToServerEvents | typeof SOCKET_EVENTS.DISCONNECT

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
  private readonly sftp: ServiceSocketSftp
  private readonly prompt: ServiceSocketPrompt

  constructor(
    private readonly socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    private readonly config: Config,
    private readonly services: Services,
    private readonly protocol: ProtocolType = 'ssh'
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
      protocol,
      debug,
      logger: createAppStructuredLogger({ namespace: 'webssh2:socket', config })
    }

    this.prompt = new ServiceSocketPrompt(this.context)
    this.auth = new ServiceSocketAuthentication(this.context, this.prompt)
    this.terminal = new ServiceSocketTerminal(this.context)
    this.control = new ServiceSocketControl(this.context)
    this.sftp = new ServiceSocketSftp(this.context)

    this.setupEventHandlers()
    this.logSessionInit()

    // Host key verification is SSH-only
    if (this.protocol === 'ssh') {
      this.emitHostKeyVerificationConfig()
    }

    this.auth.checkInitialAuth()
  }

  private setupEventHandlers(): void {
    this.socket.onAny((event: string, ...args: unknown[]) => {
      try {
        debug(`Received event '${event}' with args:`, describeInboundEvent(event, args))
      } catch {
        // Debug output must never break event dispatch
      }
    })

    this.on(
      SOCKET_EVENTS.AUTH,
      validateAuthenticateMessage,
      async (message) => {
        if (message.kind === 'keyboard-interactive') {
          // Keyboard-interactive responses are SSH-only
          if (this.protocol === 'ssh') {
            await this.auth.handleKeyboardInteractiveResponse(message.responses)
          }
          return
        }

        await this.auth.handleAuthentication(message.credentials)
      },
      (error) => {
        this.auth.rejectInvalidCredentials(error.message)
      }
    )

    this.on(SOCKET_EVENTS.TERMINAL, validateTerminalSettingsMessage, async (settings) => {
      await this.terminal.handleTerminal(settings)
    })

    this.on(SOCKET_EVENTS.RESIZE, validateResizeMessage, (dimensions) => {
      this.terminal.handleResize(dimensions)
    })

    this.on(SOCKET_EVENTS.DATA, validateDataMessage, (data) => {
      this.terminal.handleData(data)
    })

    // Exec is SSH-only
    if (this.protocol === 'ssh') {
      this.on(SOCKET_EVENTS.EXEC, validateExecRequestMessage, async (request) => {
        await this.terminal.handleExec(request)
      })
    }

    this.on(SOCKET_EVENTS.CONTROL, validateControlMessage, (action) => {
      this.control.handleControl(action)
    })

    this.on(SOCKET_EVENTS.DISCONNECT, ignorePayload, () => {
      this.control.handleDisconnect()
      if (this.protocol === 'ssh') {
        this.sftp.handleDisconnect()
      }
      this.prompt.handleDisconnect()
    })

    this.on(SOCKET_EVENTS.PROMPT_RESPONSE, validatePromptResponse, async (response) => {
      await this.prompt.handlePromptResponse(response)
    })

    // SFTP event handlers (SSH-only, validated by the SFTP adapter)
    if (this.protocol === 'ssh') {
      this.setupSftpHandlers()
    }
  }

  private setupSftpHandlers(): void {
    const sftpHandlers: ReadonlyArray<[InboundEvent, (request: unknown) => void | Promise<void>]> = [
      [SOCKET_EVENTS.SFTP_LIST, request => this.sftp.handleList(request)],
      [SOCKET_EVENTS.SFTP_STAT, request => this.sftp.handleStat(request)],
      [SOCKET_EVENTS.SFTP_MKDIR, request => this.sftp.handleMkdir(request)],
      [SOCKET_EVENTS.SFTP_DELETE, request => this.sftp.handleDelete(request)],
      [SOCKET_EVENTS.SFTP_UPLOAD_START, request => this.sftp.handleUploadStart(request)],
      [SOCKET_EVENTS.SFTP_UPLOAD_CHUNK, request => this.sftp.handleUploadChunk(request)],
      [SOCKET_EVENTS.SFTP_UPLOAD_CANCEL, request => { this.sftp.handleUploadCancel(request) }],
      [SOCKET_EVENTS.SFTP_DOWNLOAD_START, request => this.sftp.handleDownloadStart(request)],
      [SOCKET_EVENTS.SFTP_DOWNLOAD_CANCEL, request => { this.sftp.handleDownloadCancel(request) }]
    ]

    for (const [event, handler] of sftpHandlers) {
      this.on(event, acceptPayload, handler)
    }
  }

  private on<T>(
    event: InboundEvent,
    validate: (payload: unknown) => Result<T>,
    handle: (payload: T) => void | Promise<void>,
    onInvalid?: (error: Error) => void
  ): void {
    registerGuardedListener(this.context, event, validate, handle, onInvalid)
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

  /**
   * Emit host key verification config early (before auth) so the client
   * can show the Trusted Host Keys settings section immediately.
   */
  private emitHostKeyVerificationConfig(): void {
    const hostKeyVerificationConfig = this.config.ssh.hostKeyVerification
    this.socket.emit(SOCKET_EVENTS.PERMISSIONS, {
      hostKeyVerification: {
        enabled: hostKeyVerificationConfig.enabled,
        clientStoreEnabled: hostKeyVerificationConfig.clientStore.enabled,
        unknownKeyAction: hostKeyVerificationConfig.unknownKeyAction,
      },
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
