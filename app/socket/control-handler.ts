// app/socket/control-handler.ts
// Control message handler for WebSocket connections

import type { EventEmitter } from 'node:events'
import { createNamespacedDebug, createAppStructuredLogger } from '../logger.js'
import type { LogLevel } from '../logging/levels.js'
import type { LogContext, LogStatus } from '../logging/log-context.js'
import type { Credentials } from '../validation/credentials.js'
import type { Config } from '../types/config.js'
import type { Socket } from 'socket.io'
import { SOCKET_EVENTS, VALIDATION_MESSAGES, LINE_ENDINGS } from '../constants/index.js'
import type { SessionState } from './handlers/auth-handler.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'

const debug = createNamespacedDebug('socket:control')
const structuredLogger = createAppStructuredLogger({ namespace: 'webssh2:socket:control' })

export interface ControlSession {
  sshCredentials?: Credentials
  password?: string
}

export interface ReplayOptions {
  useCRLF: boolean
  password: string
}

interface ExtendedRequest {
  session?: ControlSession
  headers?: Record<string, string | string[]>
  connection?: {
    remotePort?: number
  }
}

type ReplayPasswordSource = 'session_credentials' | 'session_state'
type ReplayPasswordOrigin = ReplayPasswordSource | 'none'

interface ReplayPasswordResult {
  password: string | null
  source: ReplayPasswordOrigin
}

type WritableShellStream = EventEmitter & { write: (data: string) => void }
type ShellStreamCandidate = (EventEmitter & { write?: (data: string) => void }) | null

interface ValidatedReplayInput {
  password: string
  passwordSource: ReplayPasswordSource
  shellStream: WritableShellStream
}

interface ReplayWriteError {
  clientMessage: string
  logReason: string
}

/**
 * Validates if credential replay is allowed
 * @param config - Application configuration
 * @returns true if replay is allowed by config
 * @pure
 */
export function isReplayAllowedByConfig(config: Config): boolean {
  return config.options.allowReplay === true
}

/**
 * Extracts password for replay from session and state
 * @param session - User session
 * @param sessionState - Current session state
 * @returns Password for replay or null if not available
 * @pure
 */
export function getReplayPassword(
  session: ControlSession | undefined,
  sessionState: SessionState
): ReplayPasswordResult {
  const sessionPassword = session?.sshCredentials?.password
  if (sessionPassword != null && sessionPassword !== '') {
    return {
      password: sessionPassword,
      source: 'session_credentials'
    }
  }

  const statePassword = sessionState.password
  if (statePassword != null && statePassword !== '') {
    return {
      password: statePassword,
      source: 'session_state'
    }
  }

  return {
    password: null,
    source: 'none'
  }
}

/**
 * Validates replay request prerequisites
 * @param config - Application configuration
 * @param password - Password to replay
 * @param shellStream - Active shell stream
 * @returns Validation result with error message if invalid
 * @pure
 */
const isWritableShellStream = (stream: ShellStreamCandidate): stream is WritableShellStream => {
  return stream != null && typeof stream.write === 'function'
}

export function validateReplayRequest(
  config: Config,
  passwordResult: ReplayPasswordResult,
  shellStream: ShellStreamCandidate
): Result<ValidatedReplayInput, string> {
  if (!isReplayAllowedByConfig(config)) {
    return err(VALIDATION_MESSAGES.REPLAY_DISABLED)
  }

  const { password, source } = passwordResult

  if (password == null || password === '') {
    return err(VALIDATION_MESSAGES.NO_REPLAY_PASSWORD)
  }

  if (source === 'none') {
    return err(VALIDATION_MESSAGES.NO_REPLAY_PASSWORD)
  }

  if (!isWritableShellStream(shellStream)) {
    return err(VALIDATION_MESSAGES.NO_ACTIVE_TERMINAL)
  }

  return ok({
    password,
    passwordSource: source,
    shellStream
  })
}

/**
 * Formats replay data with appropriate line ending
 * @param password - Password to format
 * @param useCRLF - Whether to use CRLF (true) or CR (false)
 * @returns Formatted replay data
 * @pure
 */
export function formatReplayData(password: string, useCRLF: boolean): string {
  const lineEnd = useCRLF ? LINE_ENDINGS.CRLF : LINE_ENDINGS.CR
  return `${password}${lineEnd}`
}

/**
 * Determines if CRLF should be used for replay
 * @param config - Application configuration
 * @returns true if CRLF should be used
 * @pure
 */
export function shouldUseCRLF(config: Config): boolean {
  return config.options.replayCRLF === true
}

/**
 * Writes credentials to shell stream
 * @param shellStream - Shell stream to write to
 * @param options - Replay options including password and CRLF setting
 * @returns Result of the write operation
 */
export function writeCredentialsToShell(
  shellStream: WritableShellStream,
  options: ReplayOptions
): Result<void, ReplayWriteError> {
  try {
    const formattedData = formatReplayData(options.password, options.useCRLF)

    shellStream.write(formattedData)

    debug(
      `Replay credentials wrote ${options.password.length} chars + <${
        options.useCRLF ? 'CRLF' : 'CR'
      }> to shell`
    )

    return ok(undefined)
  } catch (error) {
    const message = (error as { message?: string }).message ?? String(error)
    debug(`Replay credentials write error: ${message}`)
    return err({
      clientMessage: 'Failed to replay credentials',
      logReason: message
    })
  }
}

interface CredentialReplayLogOptions {
  level: LogLevel
  status: LogStatus
  message: string
  socket: Socket
  sessionState: SessionState
  allowReplay: boolean
  lineEnding: 'crlf' | 'cr'
  passwordSource: ReplayPasswordOrigin
  reason?: string
  data?: Readonly<Record<string, unknown>>
}

function logCredentialReplay(options: CredentialReplayLogOptions): void {
  const context = createReplayLogContext(
    options.socket,
    options.sessionState,
    options.status,
    options.reason
  )

  const data = createReplayLogData(
    options.allowReplay,
    options.lineEnding,
    options.passwordSource,
    options.data
  )

  const entry = {
    level: options.level,
    event: 'credential_replay' as const,
    message: options.message,
    context,
    ...(data === null ? {} : { data })
  }

  const result = structuredLogger.log(entry)
  if (!result.ok) {
    debug('Failed to emit credential replay log:', result.error)
  }
}

function createReplayLogContext(
  socket: Socket,
  sessionState: SessionState,
  status: LogStatus,
  reason?: string
): LogContext {
  return {
    requestId: socket.id,
    protocol: 'ssh',
    subsystem: 'shell',
    status,
    ...(sessionState.username == null ? {} : { username: sessionState.username }),
    ...(sessionState.host == null ? {} : { targetHost: sessionState.host }),
    ...(sessionState.port == null ? {} : { targetPort: sessionState.port }),
    ...(reason === undefined ? {} : { reason })
  }
}

function createReplayLogData(
  allowReplay: boolean,
  lineEnding: 'crlf' | 'cr',
  passwordSource: ReplayPasswordOrigin,
  additional?: Readonly<Record<string, unknown>>
): Record<string, unknown> | null {
  const base: Record<string, unknown> = {
    allowReplay,
    lineEnding,
    passwordSource
  }

  if (additional === undefined) {
    return base
  }

  const safeAdditional = Object.fromEntries(
    Object.entries(additional).filter(([key]) => Object.hasOwn(additional, key))
  )

  return {
    ...base,
    ...safeAdditional
  }
}

/**
 * Handles credential replay control message
 * @param socket - Socket.IO socket instance
 * @param config - Application configuration
 * @param sessionState - Current session state
 * @param shellStream - Active shell stream
 */
export function handleReplayCredentials(
  socket: Socket,
  config: Config,
  sessionState: SessionState,
  shellStream: (EventEmitter & { write?: (data: string) => void }) | null
): void {
  const req = socket.request as ExtendedRequest
  const passwordLookup = getReplayPassword(req.session, sessionState)
  const validation = validateReplayRequest(config, passwordLookup, shellStream)
  const allowReplay = isReplayAllowedByConfig(config)
  const useCRLF = shouldUseCRLF(config)
  const lineEnding = useCRLF ? 'crlf' : 'cr'

  if (!validation.ok) {
    debug(`Replay credentials denied: ${validation.error}`)
    socket.emit(SOCKET_EVENTS.SSH_ERROR, validation.error)
    logCredentialReplay({
      level: 'warn',
      status: 'failure',
      message: 'Credential replay denied',
      reason: validation.error,
      socket,
      sessionState,
      allowReplay,
      lineEnding,
      passwordSource: passwordLookup.source
    })
    return
  }

  const replayOptions: ReplayOptions = {
    password: validation.value.password,
    useCRLF: useCRLF
  }

  const writeResult = writeCredentialsToShell(validation.value.shellStream, replayOptions)

  if (!writeResult.ok) {
    socket.emit(SOCKET_EVENTS.SSH_ERROR, writeResult.error.clientMessage)
    logCredentialReplay({
      level: 'error',
      status: 'failure',
      message: 'Credential replay failed to write',
      reason: writeResult.error.logReason,
      socket,
      sessionState,
      allowReplay,
      lineEnding,
      passwordSource: validation.value.passwordSource,
      data: {
        writeFailure: true
      }
    })
    return
  }

  logCredentialReplay({
    level: 'info',
    status: 'success',
    message: 'Credential replay completed',
    socket,
    sessionState,
    allowReplay,
    lineEnding,
    passwordSource: validation.value.passwordSource
  })
}

/**
 * Handles reauth control message
 * @param socket - Socket.IO socket instance
 */
export function handleReauth(socket: Socket): void {
  debug(`Reauth requested for socket ${socket.id}`)
  socket.emit('authentication', { action: 'reauth' })
}

/**
 * Routes control messages to appropriate handlers
 * @param socket - Socket.IO socket instance
 * @param config - Application configuration
 * @param sessionState - Current session state
 * @param shellStream - Active shell stream
 * @param message - Control message
 */
export function handleControlMessage(
  socket: Socket,
  config: Config,
  sessionState: SessionState,
  shellStream: (EventEmitter & { write?: (data: string) => void }) | null,
  message: unknown
): void {
  debug(`Control message received from ${socket.id}:`, message)
  
  switch (message) {
    case 'reauth':
      handleReauth(socket)
      break
      
    case 'replayCredentials':
      handleReplayCredentials(socket, config, sessionState, shellStream)
      break
      
    default:
      // V2: Silently ignore invalid control messages without logging
      debug('Ignoring unknown control message:', message)
      break
  }
}
