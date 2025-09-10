import http from 'http'
import debug from 'debug'
const serverDebug = debug('webssh:server')
/**
 * Creates and configures the HTTP server
 * @param app - The Express application instance
 * @returns The HTTP server instance
 */
export function createServer(app) {
  return http.createServer(app)
}
/**
 * Handles server errors
 * @param err - The error object
 */
function handleServerError(err) {
  console.error('HTTP Server ERROR: %O', err)
}
/**
 * Starts the server
 * @param server - The server instance
 * @param config - The configuration object
 */
export function startServer(server, config) {
  server.listen(config.listen.port, config.listen.ip, () => {
    serverDebug(`Server listening on ${config.listen.ip}:${config.listen.port}`)
  })
  server.on('error', handleServerError)
}
//# sourceMappingURL=server.js.map
