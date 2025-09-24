// app/socket/control-handler.ts
// Control message handler for WebSocket connections

import type { EventEmitter } from 'events'
import { createNamespacedDebug } from '../logger.js'
import type { Credentials } from '../validation/credentials.js'
import type { Config } from '../types/config.js'
import type { Socket } from 'socket.io'
import { SOCKET_EVENTS, VALIDATION_MESSAGES, LINE_ENDINGS } from '../constants/index.js'

const debug = createNamespacedDebug('socket:control')

export interface ControlSession {
  sshCredentials?: Credentials
  password?: string
}

export interface ReplayOptions {
  useCRLF: boolean
  password: string
}

export interface ReplayResult {
  success: boolean
  error?: string
}

interface ExtendedRequest {
  session?: ControlSession
}

interface SessionState {
  password: string | null
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
): string | null {
  const sessionPassword = session?.sshCredentials?.password
  const statePassword = sessionState.password
  
  return sessionPassword ?? statePassword ?? null
}

/**
 * Validates replay request prerequisites
 * @param config - Application configuration
 * @param password - Password to replay
 * @param shellStream - Active shell stream
 * @returns Validation result with error message if invalid
 * @pure
 */
export function validateReplayRequest(
  config: Config,
  password: string | null,
  shellStream: (EventEmitter & { write?: (data: string) => void }) | null
): { valid: boolean; error?: string } {
  if (!isReplayAllowedByConfig(config)) {
    return { valid: false, error: VALIDATION_MESSAGES.REPLAY_DISABLED }
  }

  if (password == null || password === '') {
    return { valid: false, error: VALIDATION_MESSAGES.NO_REPLAY_PASSWORD }
  }

  if (shellStream == null || typeof shellStream.write !== 'function') {
    return { valid: false, error: VALIDATION_MESSAGES.NO_ACTIVE_TERMINAL }
  }
  
  return { valid: true }
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
  shellStream: EventEmitter & { write?: (data: string) => void },
  options: ReplayOptions
): ReplayResult {
  try {
    const formattedData = formatReplayData(options.password, options.useCRLF)
    
    if (typeof shellStream.write !== 'function') {
      return {
        success: false,
        error: 'Shell stream does not support write operation'
      }
    }
    
    shellStream.write(formattedData)
    
    debug(
      `Replay credentials wrote ${options.password.length} chars + <${
        options.useCRLF ? 'CRLF' : 'CR'
      }> to shell`
    )
    
    return { success: true }
  } catch (error) {
    const message = (error as { message?: string }).message ?? String(error)
    debug(`Replay credentials write error: ${message}`)
    return {
      success: false,
      error: 'Failed to replay credentials'
    }
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
  // Operator-visible audit log without secrets
  console.info(
    `[replayCredentials] socket=${socket.id} crlf=${shouldUseCRLF(config) ? '1' : '0'}`
  )
  
  const req = socket.request as ExtendedRequest
  const password = getReplayPassword(req.session, sessionState)
  
  // Validate replay request
  const validation = validateReplayRequest(config, password, shellStream)
  if (!validation.valid) {
    debug(`Replay credentials denied: ${validation.error}`)
    socket.emit(SOCKET_EVENTS.SSH_ERROR, validation.error)
    return
  }
  
  // Perform replay (password and shellStream are guaranteed to be non-null here by validation)
  // Type narrowing: after validation, we know these are not null
  if (password == null || shellStream == null) {
    // This should never happen due to validation above, but TypeScript needs the check
    return
  }
  
  const replayOptions: ReplayOptions = {
    password: password,
    useCRLF: shouldUseCRLF(config)
  }
  
  const result = writeCredentialsToShell(shellStream, replayOptions)
  if (!result.success) {
    socket.emit(SOCKET_EVENTS.SSH_ERROR, result.error)
  }
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