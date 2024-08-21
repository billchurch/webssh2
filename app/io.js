const socketIo = require("socket.io")
const sharedsession = require("express-socket.io-session")
const { createNamespacedDebug } = require("./logger")
const { DEFAULTS } = require("./constants")

const debug = createNamespacedDebug("app")

/**
 * Configures Socket.IO with the given server
 * @param {http.Server} server - The HTTP server instance
 * @param {Function} sessionMiddleware - The session middleware
 * @param {Object} config - The configuration object
 * @returns {import('socket.io').Server} The Socket.IO server instance
 */
function configureSocketIO(server, sessionMiddleware, config) {
  const io = socketIo(server, {
    serveClient: false,
    path: DEFAULTS.IO_PATH,
    pingTimeout: DEFAULTS.IO_PING_TIMEOUT,
    pingInterval: DEFAULTS.IO_PING_INTERVAL,
    cors: config.getCorsConfig()
  })

  // Share session with io sockets
  io.use(
    sharedsession(sessionMiddleware, {
      autoSave: true
    })
  )

  debug("IO configured")

  return io
}

module.exports = { configureSocketIO }
