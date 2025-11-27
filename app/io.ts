import type { Server as HttpServer } from 'node:http'
import type { RequestHandler } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { createNamespacedDebug } from './logger.js'
import { DEFAULTS } from './constants/index.js'

const debug = createNamespacedDebug('app')

export function configureSocketIO(
  server: HttpServer,
  sessionMiddleware: RequestHandler,
  config: { getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean } }
): SocketIOServer {
  const io = new SocketIOServer(server, {
    serveClient: false,
    path: DEFAULTS.IO_PATH,
    pingTimeout: DEFAULTS.IO_PING_TIMEOUT_MS,
    pingInterval: DEFAULTS.IO_PING_INTERVAL_MS,
    cors: config.getCorsConfig(),
  })

  io.use((socket, next) => {
    // @ts-expect-error socket.request.res is optional; express-session expects a Response-like object
    sessionMiddleware(socket.request, (socket.request.res ?? {}) as Parameters<typeof sessionMiddleware>[1], next)
  })

  debug('IO configured')
  return io
}
