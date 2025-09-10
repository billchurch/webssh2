// server
// app/logger.ts
import createDebug from 'debug'
/**
 * Creates a debug function for a specific namespace
 * @param namespace - The debug namespace
 * @returns The debug function
 */
export function createNamespacedDebug(namespace) {
  return createDebug(`webssh2:${namespace}`)
}
/**
 * Logs an error message
 * @param message - The error message
 * @param error - The error object
 */
export function logError(message, error) {
  console.error(message)
  if (error) {
    console.error(`ERROR: ${error}`)
  }
}
//# sourceMappingURL=logger.js.map
