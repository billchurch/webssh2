import type { Application } from 'express'
import type { Server as HttpServer } from 'node:http'
import type { Config } from './types/config.js'
export function createServer(app: Application): HttpServer
export function startServer(server: HttpServer, config: Config): void
