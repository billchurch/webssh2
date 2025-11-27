import { MESSAGES } from '../constants/index.js'
import { WebSSH2Error } from './webssh2-error.js'

export class ConfigError extends WebSSH2Error {
  constructor(message: string) {
    super(message, MESSAGES.CONFIG_ERROR)
  }
}
