// server
// app/errors.js

import { logError, createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES } from './constants.js'

const debug = createNamespacedDebug("errors")

/**
 * Custom error for WebSSH2
 * @param {string} message - The error message
 * @param {string} code - The error code
 */
class WebSSH2Error extends Error {
  constructor(message, code) {
    super(message)
    this.name = this.constructor.name
    this.code = code
  }
}

/**
 * Custom error for configuration issues
 * @param {string} message - The error message
 */
class ConfigError extends WebSSH2Error {
  constructor(message) {
    super(message, MESSAGES.CONFIG_ERROR)
  }
}

/**
 * Custom error for SSH connection issues
 * @param {string} message - The error message
 */
class SSHConnectionError extends WebSSH2Error {
  constructor(message) {
    super(message, MESSAGES.SSH_CONNECTION_ERROR)
  }
}

/**
 * Handles an error by logging it and optionally sending a response
 * @param {Error} err - The error to handle
 * @param {Object} [res] - The response object (if in an Express route)
 */
function handleError(err, res) {
  if (err instanceof WebSSH2Error) {
    logError(err.message, err)
    debug(err.message)
    if (res) {
      res
        .status(HTTP.INTERNAL_SERVER_ERROR)
        .json({ error: err.message, code: err.code })
    }
  } else {
    logError(MESSAGES.UNEXPECTED_ERROR, err)
    debug(`handleError: ${MESSAGES.UNEXPECTED_ERROR}: %O`, err)
    if (res) {
      res
        .status(HTTP.INTERNAL_SERVER_ERROR)
        .json({ error: MESSAGES.UNEXPECTED_ERROR })
    }
  }
}

export { WebSSH2Error, ConfigError, SSHConnectionError, handleError }
