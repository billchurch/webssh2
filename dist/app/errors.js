// server
// app/errors.js
// @ts-check

import { logError, createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES } from './constants.js'

const debug = createNamespacedDebug('errors')

/**
 * Custom error for WebSSH2
 */
class WebSSH2Error extends Error {
  /**
   * @param {string} message
   * @param {string} code
   */
  constructor(message, code) {
    super(message)
    this.name = this.constructor.name
    this.code = code
  }
}

/** Configuration error */
class ConfigError extends WebSSH2Error {
  /** @param {string} message */
  constructor(message) {
    super(message, MESSAGES.CONFIG_ERROR)
  }
}

/** SSH connection error */
class SSHConnectionError extends WebSSH2Error {
  /** @param {string} message */
  constructor(message) {
    super(message, MESSAGES.SSH_CONNECTION_ERROR)
  }
}

/**
 * Handles an error by logging it and optionally sending a response
 * @param {Error} err - The error to handle
 * @param {{ status: (code:number)=>{ json: (body:any)=>void } }} [res] - Express-like response
 */
function handleError(err, res) {
  if (err instanceof WebSSH2Error) {
    logError(err.message, err)
    debug(err.message)
    if (res) {
      res.status(HTTP.INTERNAL_SERVER_ERROR).json({ error: err.message, code: err.code })
    }
  } else {
    logError(MESSAGES.UNEXPECTED_ERROR, err)
    debug(`handleError: ${MESSAGES.UNEXPECTED_ERROR}: %O`, err)
    if (res) {
      res.status(HTTP.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.UNEXPECTED_ERROR })
    }
  }
}

export { WebSSH2Error, ConfigError, SSHConnectionError, handleError }
