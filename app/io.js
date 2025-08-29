import { Server } from 'socket.io'
import { createNamespacedDebug } from './logger.js'
import { DEFAULTS } from './constants.js'

const debug = createNamespacedDebug('app')

/**
 * Configures Socket.IO with the given server
 * @param {http.Server} server - The HTTP server instance
 * @param {Function} sessionMiddleware - The session middleware
 * @param {Object} config - The configuration object
 * @returns {import('socket.io').Server} The Socket.IO server instance
 */
export function configureSocketIO(server, sessionMiddleware, config) {
  const io = new Server(server, {
    serveClient: false,
    path: DEFAULTS.IO_PATH,
    pingTimeout: DEFAULTS.IO_PING_TIMEOUT,
    pingInterval: DEFAULTS.IO_PING_INTERVAL,
    cors: config.getCorsConfig(),
    // allowEIO3: true, // Allow v2/v3 clients during migration
  })

  // Share session with io sockets using native Socket.IO 4.x approach
  io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next)
  })

  debug('IO configured')

  return io
}
