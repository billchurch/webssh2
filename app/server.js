import http from 'http'
import debug from 'debug'

const serverDebug = debug('webssh:server')
/**
 * Creates and configures the HTTP server
 * @param {express.Application} app - The Express application instance
 * @returns {http.Server} The HTTP server instance
 */
export function createServer(app) {
  return http.createServer(app)
}

/**
 * Handles server errors
 * @param {Error} err - The error object
 */
function handleServerError(err) {
  console.error('HTTP Server ERROR: %O', err)
}

/**
 * Starts the server
 * @param {http.Server} server - The server instance
 * @param {Object} config - The configuration object
 */
export function startServer(server, config) {
  server.listen(config.listen.port, config.listen.ip, () => {
    serverDebug(`Server listening on ${config.listen.ip}:${config.listen.port}`)
  })

  server.on('error', handleServerError)
}
