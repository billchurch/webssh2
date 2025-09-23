// app/socket-switcher.ts
// Feature flag to switch between old and new socket implementation

import type { Server as IOServer } from 'socket.io'
import { createNamespacedDebug } from './logger.js'
import initV1 from './socket.js'
import initV2 from './socket-v2.js'
import type { Config } from './types/config.js'
import type { SSHCtor } from './socket.js'
import type { Services } from './services/interfaces.js'
import type { SessionStore } from './state/store.js'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types/contracts/v1/socket.js'

const debug = createNamespacedDebug('socket:switcher')

/**
 * Initialize v2 socket with optional services
 */
function initV2Socket(
  io: IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  config: Config,
  SSHConnectionClass: SSHCtor,
  services?: Services,
  store?: SessionStore
): void {
  if (services !== undefined && store !== undefined) {
    debug('Services provided - using service-based adapters')
    initV2(io, config, SSHConnectionClass, services, store)
  } else {
    debug('Warning: Services not provided, using v2 with legacy adapters')
    initV2(io, config, SSHConnectionClass)
  }
}

/**
 * Initialize Socket.IO with either v1 (legacy) or v2 (refactored) implementation
 * based on environment variable or config setting
 */
export default function initSocket(
  io: IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  config: Config,
  SSHConnectionClass: SSHCtor,
  services?: Services,
  store?: SessionStore
): void {
  const version = getSocketVersion()

  if (version === 'v2') {
    debug('Using v2 (refactored) socket implementation')
    initV2Socket(io, config, SSHConnectionClass, services, store)
  } else {
    debug('Using v1 (legacy) socket implementation')
    initV1(io, config, SSHConnectionClass)
  }
}

/**
 * Get version of socket implementation being used
 */
export function getSocketVersion(): 'v1' | 'v2' {
  const useV2 = process.env['WEBSSH2_USE_V2_SOCKET'] === 'true' ||
                process.env['WEBSSH2_USE_REFACTORED_SOCKET'] === 'true'

  if (useV2) {
    return 'v2'
  }
  return 'v1'
}