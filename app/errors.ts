// server
// app/errors.ts

import { logError, createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES } from './constants/index.js'
import { WebSSH2Error } from './errors/webssh2-error.js'

export { WebSSH2Error } from './errors/webssh2-error.js'
export { ConfigError } from './errors/config-error.js'
export { SSHConnectionError } from './errors/ssh-connection-error.js'

const debug = createNamespacedDebug('errors')

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
