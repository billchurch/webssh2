// app/socket-v2.ts
// Refactored WebSSH2Socket using pure handlers and I/O adapters

import type { Server as IOServer } from 'socket.io'
import { createNamespacedDebug } from './logger.js'
import { ServiceSocketAdapter } from './socket/adapters/service-socket-adapter.js'
import type { Config } from './types/config.js'
import type { Services } from './services/interfaces.js'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types/contracts/v1/socket.js'

const debug = createNamespacedDebug('socket:v2')

/**
 * Initialize Socket.IO with service-based architecture
 */
export default function init(
  io: IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  config: Config,
  services: Services
): void {
  debug('V2 socket init() called - registering connection handler')
  io.on('connection', (socket) => {
    debug(`V2 connection handler triggered for socket ${socket.id}`)
    debug('Using service-based socket adapter')

    // ServiceSocketAdapter sets up all handlers in its constructor
    const serviceAdapter = new ServiceSocketAdapter(socket, config, services)
    // Keep reference to prevent GC (adapter manages its own lifecycle via socket events)
    void serviceAdapter //NOSONAR
  })
}
