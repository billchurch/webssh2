import type { AdapterContext, SSH2Stream } from './service-socket-shared.js'
import type { TerminalSettings } from '../../types/contracts/v1/socket.js'
import type { SessionId } from '../../types/branded.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import { VALIDATION_MESSAGES } from '../../constants/validation.js'
import { buildTerminalDefaults, createConnectionIdentifier } from './ssh-config.js'
import { emitSocketLog, type SocketLogOptions } from '../../logging/socket-logger.js'
import type { LogLevel } from '../../logging/levels.js'

interface TerminalConfig {
  sessionId: SessionId
  term: string
  rows: number
  cols: number
  env: Record<string, string>
}

/** Mutable state for SSH-to-WebSocket backpressure control */
interface BackpressureState {
  paused: boolean
  checkTimerId: ReturnType<typeof setTimeout> | null
}

const LOW_WATER_MARK_DIVISOR = 4

/**
 * Safely reads bufferedAmount from the ws WebSocket via the Engine.IO
 * transport chain. Returns null when unavailable (polling transport,
 * access failure, or during transport upgrade).
 */
export function getWebSocketBufferedBytes(
  socket: AdapterContext['socket']
): number | null {
  try {
    // Access Engine.IO internals via unknown to avoid coupling to private types
    // while remaining defensive at runtime
    const conn: unknown = socket.conn
    if (typeof conn !== 'object' || conn === null) {
      return null
    }
    const transport: unknown = (conn as Record<string, unknown>)['transport']
    if (typeof transport !== 'object' || transport === null) {
      return null
    }
    const transportRecord = transport as Record<string, unknown>
    if (transportRecord['name'] !== 'websocket') {
      return null
    }
    const wsSocket: unknown = transportRecord['socket']
    if (typeof wsSocket !== 'object' || wsSocket === null) {
      return null
    }
    const amount: unknown = (wsSocket as Record<string, unknown>)['bufferedAmount']
    if (typeof amount !== 'number') {
      return null
    }
    return amount
  } catch {
    return null
  }
}

/**
 * Pure decision function for backpressure control.
 * Returns 'pause' when buffer exceeds high water mark,
 * 'resume' when buffer drops below low water mark (HWM / 4),
 * or 'none' when no action is needed.
 */
export function computeBackpressureAction(
  bufferedBytes: number | null,
  highWaterMark: number,
  currentlyPaused: boolean
): 'pause' | 'resume' | 'none' {
  if (bufferedBytes === null) {
    return 'none'
  }
  const lowWaterMark = Math.floor(highWaterMark / LOW_WATER_MARK_DIVISOR)
  if (!currentlyPaused && bufferedBytes >= highWaterMark) {
    return 'pause'
  }
  if (currentlyPaused && bufferedBytes < lowWaterMark) {
    return 'resume'
  }
  return 'none'
}

export class ServiceSocketTerminal {
  constructor(private readonly context: AdapterContext) {}

  async handleTerminal(settings: TerminalSettings): Promise<void> {
    try {
      if (!this.hasActiveSession()) {
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
      this.context.debug('Terminal created successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terminal setup failed'
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, message)
      this.context.debug('Terminal error:', error)
    }
  }

  handleResize(dimensions: { rows: number; cols: number }): void {
    if (this.context.state.sessionId === null) {
      this.context.debug('Resize ignored: No session ID yet')
      return
    }

    const terminalResult = this.context.services.terminal.getTerminal(this.context.state.sessionId)

    if (terminalResult.ok && terminalResult.value !== null) {
      const result = this.context.services.terminal.resize(this.context.state.sessionId, dimensions)

      if (result.ok) {
        emitSocketLog(this.context, 'info', 'pty_resize', 'Terminal resized', {
          status: 'success',
          data: { rows: dimensions.rows, cols: dimensions.cols }
        })
      } else {
        this.context.debug('Resize failed:', result.error)
        emitSocketLog(this.context, 'warn', 'pty_resize', 'Terminal resize failed', {
          status: 'failure',
          reason: result.error.message,
          data: { rows: dimensions.rows, cols: dimensions.cols }
        })
      }
    } else {
      this.context.debug('Resize ignored: Terminal not created yet for session', this.context.state.sessionId)
      this.context.state.initialTermSettings.rows = dimensions.rows
      this.context.state.initialTermSettings.cols = dimensions.cols
      emitSocketLog(this.context, 'debug', 'pty_resize', 'Resize deferred until terminal is ready', {
        data: { rows: dimensions.rows, cols: dimensions.cols }
      })
      return
    }

    if (this.context.state.shellStream?.setWindow !== undefined) {
      this.context.state.shellStream.setWindow(dimensions.rows, dimensions.cols)
    }
  }

  handleData(data: string): void {
    this.context.state.shellStream?.write(data)
  }

  async handleExec(request: unknown): Promise<void> {
    if (this.context.state.connectionId === null) {
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, VALIDATION_MESSAGES.NO_SSH_CONNECTION)
      return
    }

    const command =
      typeof request === 'object' && request !== null && 'command' in (request as Record<string, unknown>)
        ? String((request as { command: string }).command)
        : ''

    try {
      const connectionId = createConnectionIdentifier(this.context)
      if (connectionId === null) {
        this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, VALIDATION_MESSAGES.NO_SSH_CONNECTION)
        return
      }

      await this.performExec(command, connectionId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Exec failed'
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, message)
      this.logExecFailure(command, 0, message, 'error')
    }
  }

  private hasActiveSession(): boolean {
    if (this.context.state.sessionId === null || this.context.state.connectionId === null) {
      this.context.debug('No session or connection for terminal')
      return false
    }

    return true
  }

  private buildTerminalConfig(settings: TerminalSettings): TerminalConfig {
    const defaults = buildTerminalDefaults(settings, this.context)

    return {
      sessionId: this.context.state.sessionId as SessionId,
      term: defaults.term,
      rows: defaults.rows,
      cols: defaults.cols,
      env: defaults.env
    }
  }

  private createTerminal(config: TerminalConfig): boolean {
    const terminalResult = this.context.services.terminal.create(config)

    if (terminalResult.ok) {
      return true
    }

    this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, terminalResult.error.message)
    return false
  }

  private async openShell(config: TerminalConfig): Promise<SSH2Stream | null> {
    const connectionId = createConnectionIdentifier(this.context)

    if (connectionId === null) {
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, VALIDATION_MESSAGES.NO_SSH_CONNECTION)
      return null
    }

    this.context.debug('Opening shell with config:', {
      term: config.term,
      rows: config.rows,
      cols: config.cols,
      hasEnv: Object.keys(config.env).length > 0
    })

    const shellResult = await this.context.services.ssh.shell(connectionId, {
      term: config.term,
      rows: config.rows,
      cols: config.cols,
      env: config.env
    })

    if (shellResult.ok) {
      return shellResult.value
    }

    this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, shellResult.error.message)
    return null
  }

  private setupShellDataFlow(stream: SSH2Stream): void {
    this.context.state.shellStream = stream

    // Get rate limit configuration (0 = unlimited)
    const rateLimitBytesPerSec = this.context.config.ssh.outputRateLimitBytesPerSec ?? 0

    let rateLimitState:
      | { bytesInWindow: number; windowStart: number; paused: boolean }
      | null = rateLimitBytesPerSec > 0 ? { bytesInWindow: 0, windowStart: Date.now(), paused: false } : null

    // Backpressure state for WebSocket outbound buffer
    const highWaterMark = this.context.config.ssh.socketHighWaterMark ?? 16384
    const backpressure: BackpressureState = { paused: false, checkTimerId: null }

    const clearResumeSchedule = (): void => {
      if (backpressure.checkTimerId !== null) {
        clearTimeout(backpressure.checkTimerId)
        backpressure.checkTimerId = null
      }
      this.context.socket.conn.removeListener('drain', onDrainCheck)
    }

    const onDrainCheck = (): void => {
      checkResume()
    }

    const checkResume = (): void => {
      const buffered = getWebSocketBufferedBytes(this.context.socket)
      const action = computeBackpressureAction(buffered, highWaterMark, backpressure.paused)
      if (action === 'resume') {
        backpressure.paused = false
        clearResumeSchedule()
        stream.resume()
        this.context.debug('Backpressure relieved, resuming SSH stream (buffered=%d)', buffered)
      } else if (backpressure.paused) {
        // Still above low water mark — re-register for next drain + safety timer
        scheduleResumeCheck()
      }
    }

    const scheduleResumeCheck = (): void => {
      clearResumeSchedule()
      this.context.socket.conn.once('drain', onDrainCheck)
      backpressure.checkTimerId = setTimeout(() => {
        backpressure.checkTimerId = null
        checkResume()
      }, 50)
    }

    const checkBackpressure = (): void => {
      const buffered = getWebSocketBufferedBytes(this.context.socket)
      const action = computeBackpressureAction(buffered, highWaterMark, backpressure.paused)
      if (action === 'pause') {
        backpressure.paused = true
        stream.pause()
        this.context.debug('Backpressure detected, pausing SSH stream (buffered=%d)', buffered)
        scheduleResumeCheck()
      }
    }

    stream.on('data', (chunk: Buffer) => {
      const chunkSize = chunk.length

      // Apply rate limiting if configured
      if (rateLimitState !== null) {
        const now = Date.now()
        const windowElapsed = now - rateLimitState.windowStart

        // Reset window every second
        if (windowElapsed >= 1000) {
          rateLimitState.bytesInWindow = 0
          rateLimitState.windowStart = now
        }

        // Check if we would exceed rate limit
        if (rateLimitState.bytesInWindow + chunkSize > rateLimitBytesPerSec) {
          if (!rateLimitState.paused) {
            stream.pause()
            rateLimitState.paused = true
            this.context.debug('Rate limit reached, pausing SSH stream')
          }

          // Schedule resume at next window
          const delayMs = 1000 - windowElapsed
          setTimeout(() => {
            if (rateLimitState !== null) {
              rateLimitState.bytesInWindow = 0
              rateLimitState.windowStart = Date.now()
              rateLimitState.paused = false
              if (!backpressure.paused) {
                stream.resume()
              }
              this.context.debug('Rate limit window reset, resuming SSH stream')
            }
          }, delayMs)

          return
        }

        rateLimitState.bytesInWindow += chunkSize
      }

      this.context.socket.emit(SOCKET_EVENTS.SSH_DATA, chunk)

      // Check backpressure after emit (standard Node.js streams pattern)
      if (!backpressure.paused) {
        checkBackpressure()
      }
    })

    stream.on('close', () => {
      clearResumeSchedule()
      rateLimitState = null
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, VALIDATION_MESSAGES.CONNECTION_CLOSED)
      this.context.socket.disconnect()
    })
  }

  private logExecSuccess(
    command: string,
    durationMs: number,
    result: { stdout: string; stderr: string; code: number }
  ): void {
    const status = result.code === 0 ? 'success' : 'failure'
    const level: LogLevel = status === 'success' ? 'info' : 'warn'
    const logOptions: SocketLogOptions = {
      status,
      subsystem: 'exec',
      durationMs,
      bytesOut: Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr),
      bytesIn: Buffer.byteLength(command),
      ...(status === 'failure' ? { reason: `Command exited with code ${result.code}` } : {}),
      data: {
        command,
        exit_code: result.code
      }
    }

    emitSocketLog(this.context, level, 'ssh_command', 'SSH exec command completed', logOptions)
  }

  private logExecFailure(command: string, durationMs: number, reason: string, level: LogLevel): void {
    emitSocketLog(this.context, level, 'ssh_command', 'SSH exec command failed', {
      status: 'failure',
      subsystem: 'exec',
      durationMs,
      reason,
      data: {
        command
      }
    })
  }

  private async performExec(
    command: string,
    connectionId: ReturnType<typeof createConnectionIdentifier>
  ): Promise<void> {
    if (connectionId === null) {
      return
    }

    const start = Date.now()
    const result = await this.context.services.ssh.exec(connectionId, command)

    if (result.ok) {
      this.context.socket.emit(SOCKET_EVENTS.SSH_DATA, result.value.stdout)

      if (result.value.stderr !== '') {
        this.context.socket.emit(SOCKET_EVENTS.SSH_DATA, result.value.stderr)
      }

      this.logExecSuccess(command, Date.now() - start, result.value)
      return
    }

    this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, result.error.message)
    this.logExecFailure(command, Date.now() - start, result.error.message, 'warn')
  }
}
