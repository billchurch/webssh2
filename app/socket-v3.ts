/**
 * Event-driven Socket.IO initialization using event bus architecture
 */

import type { Server as IOServer } from 'socket.io'
import type { Config } from './types/config.js'
import type { Services } from './services/interfaces.js'
import type { SessionStore } from './state/store.js'
import type { EventBus } from './events/event-bus.js'
import { EventSocketAdapter } from './socket/adapters/event-socket-adapter.js'
import { createNamespacedDebug } from './logger.js'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types/contracts/v1/socket.js'

const debug = createNamespacedDebug('socket:v3')

/**
 * Initialize Socket.IO with event-driven architecture
 */
export default function init(
  io: IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  config: Config,
  services: Services,
  store: SessionStore,
  eventBus: EventBus
): void {
  debug('Initializing event-driven socket handler')

  io.on('connection', (socket) => {
    debug(`New connection: ${socket.id}`)

    // Create event-driven adapter for this socket
    const adapter = new EventSocketAdapter(socket, config, eventBus, store)

    debug(`Created event adapter for session ${adapter.getSessionId()}`)

    // Socket lifecycle is managed by the adapter
    socket.on('disconnect', () => {
      debug(`Socket ${socket.id} disconnected, session ${adapter.getSessionId()}`)
    })
  })

  debug('Event-driven socket handler initialized')
}