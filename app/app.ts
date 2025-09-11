import type { Application, RequestHandler } from 'express'
import type { Server as HttpServer } from 'node:http'
import type { Server as IOServer } from 'socket.io'
import type { Config } from './types/config.js'
import * as Impl from './app.impl.js'

export const createAppAsync: (appConfig: Config) => {
  app: Application
  sessionMiddleware: RequestHandler
} = Impl.createAppAsync as unknown as (appConfig: Config) => {
  app: Application
  sessionMiddleware: RequestHandler
}

export const initializeServerAsync: () => Promise<{
  server: HttpServer
  io: IOServer
  app: Application
  config: Config
}> = Impl.initializeServerAsync as unknown as () => Promise<{
  server: HttpServer
  io: IOServer
  app: Application
  config: Config
}>
