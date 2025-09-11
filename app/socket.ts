// server
// app/socket.ts
// Type-only mirror that re-exports JS implementation without changing runtime

import type { Server as SocketIOServer } from 'socket.io'
import type { Config } from './types/config.js'
// prettier-ignore
import type { ClientToServerEvents as C2S, ServerToClientEvents as S2C, InterServerEvents as IS, SocketData as SD } from './types/contracts/v1/socket.js'

import impl from './socket.impl.js'

// Default initializer with strong types; delegates to JS implementation
export default function init(
  io: SocketIOServer<C2S, S2C, IS, SD>,
  config: Config,
  SSHConnectionClass: new (config: Config) => unknown
): void {
  // Cast through unknown to avoid changing runtime while preserving types
  ;(impl as unknown as (io: unknown, config: unknown, SSHConnectionClass: unknown) => void)(
    io,
    config,
    SSHConnectionClass
  )
}
