// server
// app/errors.js

const util = require("util")
const { logError, createNamespacedDebug } = require("./logger")
const { HTTP, MESSAGES } = require("./constants")

const debug = createNamespacedDebug("errors")

/**
 * Custom error for WebSSH2
 * @param {string} message - The error message
 * @param {string} code - The error code
 */
function WebSSH2Error(message, code) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = message
  this.code = code
}

util.inherits(WebSSH2Error, Error)

/**
 * Custom error for configuration issues
 * @param {string} message - The error message
 */
function ConfigError(message) {
  WebSSH2Error.call(this, message, MESSAGES.CONFIG_ERROR)
}

util.inherits(ConfigError, WebSSH2Error)

/**
 * Custom error for SSH connection issues
 * @param {string} message - The error message
 */
function SSHConnectionError(message) {
  WebSSH2Error.call(this, message, MESSAGES.SSH_CONNECTION_ERROR)
}

util.inherits(SSHConnectionError, WebSSH2Error)

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

module.exports = {
  WebSSH2Error: WebSSH2Error,
  ConfigError: ConfigError,
  SSHConnectionError: SSHConnectionError,
  handleError: handleError
}
