import socketIo from 'socket.io'
import sharedsession from 'express-socket.io-session'
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
  const io = socketIo(server, {
    serveClient: false,
    path: DEFAULTS.IO_PATH,
    pingTimeout: DEFAULTS.IO_PING_TIMEOUT,
    pingInterval: DEFAULTS.IO_PING_INTERVAL,
    cors: config.getCorsConfig(),
  })

  // Share session with io sockets
  io.use(
    sharedsession(sessionMiddleware, {
      autoSave: true,
    })
  )

  debug('IO configured')

  return io
}
