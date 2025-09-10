import { Server as SocketIOServer } from 'socket.io'
import { createNamespacedDebug } from './logger.js'
import { DEFAULTS } from './constants.js'
const debug = createNamespacedDebug('app')
/**
 * Configures Socket.IO with the given server
 * @param server - The HTTP server instance
 * @param sessionMiddleware - The session middleware
 * @param config - The configuration object
 * @returns The Socket.IO server instance
 */
export function configureSocketIO(server, sessionMiddleware, config) {
  const io = new SocketIOServer(server, {
    serveClient: false,
    path: DEFAULTS.IO_PATH,
    pingTimeout: DEFAULTS.IO_PING_TIMEOUT,
    pingInterval: DEFAULTS.IO_PING_INTERVAL,
    cors: config.getCorsConfig(),
    // allowEIO3: true, // Allow v2/v3 clients during migration
  })
  // Share session with io sockets using native Socket.IO 4.x approach
  io.use((socket, next) => {
    const req = socket.request
    const res = socket.request.res || {}
    sessionMiddleware(req, res, next)
  })
  debug('IO configured')
  return io
}
//# sourceMappingURL=io.js.map
