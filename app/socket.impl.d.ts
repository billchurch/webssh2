import type { EventEmitter } from 'node:events'
import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { Config } from './types/config.js'
// prettier-ignore
import type { ClientToServerEvents as C2S, ServerToClientEvents as S2C, InterServerEvents as IS, SocketData as SD } from './types/contracts/v1/socket.js'

declare module './socket.impl.js' {
  export class WebSSH2Socket extends EventEmitter {
    constructor(
      socket: Socket<C2S, S2C, IS, SD>,
      config: Config,
      SSHConnectionClass: new (config: Config) => unknown
    )
  }

  export default function init(
    io: SocketIOServer<C2S, S2C, IS, SD>,
    config: Config,
    SSHConnectionClass: new (config: Config) => unknown
  ): void
}
