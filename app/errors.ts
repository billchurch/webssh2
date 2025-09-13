// server
// app/errors.ts

import { logError, createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES } from './constants.js'

const debug = createNamespacedDebug('errors')

export class WebSSH2Error extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = new.target.name
    this.code = code
  }
}

export class ConfigError extends WebSSH2Error {
  constructor(message: string) {
    super(message, MESSAGES.CONFIG_ERROR)
  }
}

export class SSHConnectionError extends WebSSH2Error {
  constructor(message: string) {
    super(message, MESSAGES.SSH_CONNECTION_ERROR)
  }
}

interface ResponseLike { status: (code: number) => { json: (body: unknown) => void } }

export function handleError(err: Error, res?: ResponseLike): void {
  if (err instanceof WebSSH2Error) {
    logError(err.message, err)
    debug(err.message)
    if (res != null) {
      res.status(HTTP.INTERNAL_SERVER_ERROR).json({ error: err.message, code: err.code })
    }
  } else {
    logError(MESSAGES.UNEXPECTED_ERROR, err)
    debug(`handleError: ${MESSAGES.UNEXPECTED_ERROR}: %O`, err)
    if (res != null) {
      res.status(HTTP.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.UNEXPECTED_ERROR })
    }
  }
}
