import type { Application } from 'express'
import type { Server as HttpServer } from 'node:http'
import type { Config } from './types/config.js'
import http from 'node:http'
import debug from 'debug'

const serverDebug = debug('webssh:server')

export function createServer(app: Application): HttpServer {
  return http.createServer(app)
}

function handleServerError(err: unknown): void {
  console.error('HTTP Server ERROR: %O', err)
}

export function startServer(server: HttpServer, config: Config): void {
  server.listen(config.listen.port, config.listen.ip, () => {
    serverDebug(`Server listening on ${config.listen.ip}:${config.listen.port}`)
  })
  server.on('error', handleServerError)
}
