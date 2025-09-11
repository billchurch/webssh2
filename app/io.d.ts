import type { Server as HttpServer } from 'node:http'
import type { Server as SocketIOServer } from 'socket.io'

export function configureSocketIO(
  server: HttpServer,
  sessionMiddleware: (req: unknown, res: unknown, next: (err?: unknown) => void) => void,
  config: { getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean } }
): SocketIOServer
