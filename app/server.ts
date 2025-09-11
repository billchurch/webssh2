import type { Application } from 'express'
import type { Server as HttpServer } from 'node:http'
import * as Impl from './server.impl.js'

export const createServer: (app: Application) => HttpServer = Impl.createServer as unknown as (
  app: Application
) => HttpServer

import type { Config } from './types/config.js'
export const startServer: (server: HttpServer, config: Config) => void =
  Impl.startServer as unknown as (server: HttpServer, config: Config) => void
