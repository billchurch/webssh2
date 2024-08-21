// server
// app/logger.js

const createDebug = require("debug")

/**
 * Creates a debug function for a specific namespace
 * @param {string} namespace - The debug namespace
 * @returns {Function} The debug function
 */
function createNamespacedDebug(namespace) {
  return createDebug(`webssh2:${namespace}`)
}

/**
 * Logs an error message
 * @param {string} message - The error message
 * @param {Error} [error] - The error object
 */
function logError(message, error) {
  console.error(message)
  if (error) {
    console.error(`ERROR: ${error}`)
  }
}

module.exports = {
  createNamespacedDebug: createNamespacedDebug,
  logError: logError
}
