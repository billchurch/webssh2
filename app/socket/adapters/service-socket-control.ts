import type { AdapterContext } from './service-socket-shared.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import { createConnectionId } from '../../types/branded.js'

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
      void this.context.services.ssh.disconnect(createConnectionId(this.context.state.connectionId))
    }

    if (this.context.state.sessionId !== null) {
      this.context.services.terminal.destroy(this.context.state.sessionId)
      this.context.services.session.delete(this.context.state.sessionId)
    }

    this.context.state.storedPassword = null
    this.context.state.shellStream = null
    this.context.state.connectionId = null
    this.context.state.sessionId = null
  }

  private handleReplayCredentials(): void {
    if (!this.context.config.options.allowReplay) {
      this.context.debug('Credential replay not permitted by configuration')
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'Credential replay not permitted')
      return
    }

    if (this.context.state.storedPassword === null) {
      this.context.debug('No stored password for credential replay')
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'No stored password available')
      return
    }

    if (this.context.state.shellStream === null) {
      this.context.debug('No active shell for credential replay')
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'No active shell')
      return
    }

    const lineEnding = this.context.config.options.replayCRLF === true ? '\r\n' : '\n'
    const passwordToSend = this.context.state.storedPassword + lineEnding

    try {
      this.context.state.shellStream.write(passwordToSend)
      this.context.debug(`Credential replay completed, socket=${this.context.socket.id} crlf=${this.context.config.options.replayCRLF === true ? '1' : '0'}`)
    } catch (error) {
      this.context.debug('Failed to replay credentials:', error)
      this.context.socket.emit(SOCKET_EVENTS.SSH_ERROR, 'Failed to replay credentials')
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
}
