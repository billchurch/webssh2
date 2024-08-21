const socketIo = require("socket.io")
const sharedsession = require("express-socket.io-session")
const { createNamespacedDebug } = require("./logger")

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
    path: "/ssh/socket.io",
    pingTimeout: 60000, // 1 minute
    pingInterval: 25000, // 25 seconds
    cors: config.getCorsConfig()
  })

  // Share session with io sockets
  io.use(
    sharedsession(sessionMiddleware, {
      autoSave: true
    })
  )

  debug("Socket.IO configured")

  return io
}

module.exports = { configureSocketIO }
