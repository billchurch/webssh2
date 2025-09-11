import type { Server as HttpServer } from 'node:http'
import type { Server as SocketIOServer } from 'socket.io'
import type { RequestHandler } from 'express'
export function configureSocketIO(
  server: HttpServer,
  sessionMiddleware: RequestHandler,
  config: { getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean } }
): SocketIOServer
