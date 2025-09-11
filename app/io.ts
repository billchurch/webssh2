import type { Server as HttpServer } from 'node:http'
import type { Server as SocketIOServer } from 'socket.io'
import type { RequestHandler } from 'express'

import * as Impl from './io.impl.js'

export const configureSocketIO: (
  server: HttpServer,
  sessionMiddleware: RequestHandler,
  config: { getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean } }
) => SocketIOServer = Impl.configureSocketIO as unknown as (
  server: HttpServer,
  sessionMiddleware: RequestHandler,
  config: { getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean } }
) => SocketIOServer
