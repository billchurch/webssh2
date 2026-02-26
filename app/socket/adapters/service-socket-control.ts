import type { AdapterContext } from './service-socket-shared.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import { createConnectionId } from '../../types/branded.js'
import { emitSocketLog } from '../../logging/socket-logger.js'
import type { LogLevel } from '../../logging/levels.js'
import type { LogStatus } from '../../logging/log-context.js'

export class ServiceSocketControl {
  constructor(private readonly context: AdapterContext) {}

  handleControl(message: string): void {
    switch (message) {
      case 'replayCredentials':
        this.handleReplayCredentials()
        break
      case 'reauth':
        this.handleReauth()
        break
      default:
        this.context.debug('Unknown control message:', message)
        break
    }
  }

  handleDisconnect(): void {
    this.context.debug('Client disconnected')

    if (this.context.state.connectionId !== null) {
      const connId = createConnectionId(this.context.state.connectionId)
      if (this.context.protocol === 'telnet' && this.context.services.telnet !== undefined) {
        void this.context.services.telnet.disconnect(connId)
      } else {
        void this.context.services.ssh.disconnect(connId)
      }
    }

    if (this.context.state.sessionId !== null) {
      this.context.services.terminal.destroy(this.context.state.sessionId)
      this.context.services.session.delete(this.context.state.sessionId)
    }

    this.context.state.storedPassword = null
    this.context.state.shellStream = null
    this.context.state.connectionId = null
    this.context.state.sessionId = null
    this.context.state.targetHost = null
    this.context.state.targetPort = null
    this.context.state.username = null
  }

  private handleReplayCredentials(): void {
    if (!this.context.config.options.allowReplay) {
      this.rejectReplay(
        'warn',
        'Credential replay not permitted by configuration',
        'Credential replay denied by configuration',
        'Credential replay not permitted',
        { allowReplay: false }
      )
      return
    }

    if (this.context.state.storedPassword === null) {
      this.rejectReplay(
        'warn',
        'No stored password for credential replay',
        'Credential replay failed: no stored password',
        'No stored password available'
      )
      return
    }

    if (this.context.state.shellStream === null) {
      this.rejectReplay(
        'warn',
        'No active shell for credential replay',
        'Credential replay failed: no active shell',
        'No active shell'
      )
      return
    }

    const lineEnding = this.context.config.options.replayCRLF === true ? '\r\n' : '\n'
    const passwordToSend = this.context.state.storedPassword + lineEnding

    try {
      this.context.state.shellStream.write(passwordToSend)
      this.context.debug(`Credential replay completed, socket=${this.context.socket.id} crlf=${this.context.config.options.replayCRLF === true ? '1' : '0'}`)
      this.logCredentialReplay('info', 'success', 'Credential replay completed', {
        allowReplay: true
      })
    } catch (error) {
      this.context.debug('Failed to replay credentials:', error)
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'Failed to replay credentials')
      const reason = error instanceof Error ? error.message : 'Unknown error'
      this.logCredentialReplay(
        'error',
        'failure',
        'Credential replay failed to write',
        undefined,
        reason
      )
    }
  }

  private handleReauth(): void {
    if (this.context.config.options.allowReauth) {
      this.context.debug('Requesting re-authentication')
      this.context.socket.emit(SOCKET_EVENTS.AUTHENTICATION, { action: 'reauth' })
    } else {
      this.context.debug('Re-authentication not permitted')
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'Re-authentication not permitted')
    }
  }

  private logCredentialReplay(
    level: LogLevel,
    status: LogStatus,
    message: string,
    data: Record<string, unknown> = {},
    reason?: string
  ): void {
    emitSocketLog(this.context, level, 'credential_replay', message, {
      status,
      subsystem: 'shell',
      ...(reason === undefined ? {} : { reason }),
      data
    })
  }

  private rejectReplay(
    level: LogLevel,
    debugMessage: string,
    logMessage: string,
    reason: string,
    data?: Record<string, unknown>
  ): void {
    this.context.debug(debugMessage)
    this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, reason)
    this.logCredentialReplay(level, 'failure', logMessage, data, reason)
  }
}
