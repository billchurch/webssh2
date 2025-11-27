import { MESSAGES } from '../constants/index.js'
import { WebSSH2Error } from './webssh2-error.js'

export class SSHConnectionError extends WebSSH2Error {
  constructor(message: string) {
    super(message, MESSAGES.SSH_CONNECTION_ERROR)
  }
}
