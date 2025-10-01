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

    stream.on('data', (chunk: Buffer) => {
      this.context.socket.emit(SOCKET_EVENTS.SSH_DATA, chunk.toString('utf8'))
    })

    stream.on('close', () => {
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
