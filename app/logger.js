// server
// app/logger.js

import createDebug from 'debug'

/**
 * Creates a debug function for a specific namespace
 * @param {string} namespace - The debug namespace
 * @returns {Function} The debug function
 */
export function createNamespacedDebug(namespace) {
  return createDebug(`webssh2:${namespace}`)
}

/**
 * Logs an error message
 * @param {string} message - The error message
 * @param {Error} [error] - The error object
 */
export function logError(message, error) {
  console.error(message)
  if (error) {
    console.error(`ERROR: ${error}`)
  }
}
