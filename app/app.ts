import express, { type Application, type RequestHandler } from 'express'
import type { Server as HttpServer } from 'node:http'
import type { Server as IOServer } from 'socket.io'
import { getConfig } from './config.js'
import SSHConnection from './ssh.js'
import initSocket from './socket-switcher.js'
import type { SSHCtor } from './socket.js'
import { createRoutes } from './routes.js'
import { applyMiddleware } from './middleware.js'
import { createServer, startServer } from './server.js'
import { configureSocketIO } from './io.js'
import { handleError, ConfigError } from './errors.js'
import { createNamespacedDebug } from './logger.js'
import { MESSAGES } from './constants.js'
import { getClientPublicPath } from './client-path.js'
import type { Config } from './types/config.js'
import { initializeGlobalContainer } from './services/setup.js'
import { TOKENS } from './services/container.js'
import type { Services } from './services/interfaces.js'

const debug = createNamespacedDebug('app')

export function createAppAsync(appConfig: Config): {
  app: Application
  sessionMiddleware: RequestHandler
} {
  const app = express()
  try {
    const clientPath = getClientPublicPath()
    const { sessionMiddleware } = applyMiddleware(app, appConfig) as unknown as {
      sessionMiddleware: RequestHandler
    }
    const sshRoutes = createRoutes(appConfig)
    app.use('/ssh/assets', express.static(clientPath))
    app.use('/ssh', sshRoutes)
    return { app, sessionMiddleware }
  } catch (err) {
    const message =
      err !== null && err !== undefined && typeof err === 'object' && 'message' in (err as { message?: unknown })
        ? String((err as { message?: unknown }).message)
        : String(err)
    throw new ConfigError(`${MESSAGES.EXPRESS_APP_CONFIG_ERROR}: ${message}`)
  }
}

export async function initializeServerAsync(): Promise<{
  server: HttpServer
  io: IOServer
  app: Application
  config: Config
  services: Services
}> {
  try {
    const appConfig = await getConfig()
    debug('Configuration loaded asynchronously')

    // Initialize DI container and services
    const container = initializeGlobalContainer(appConfig)
    const services = container.resolve<Services>(TOKENS.Services)
    const store = container.resolve(TOKENS.SessionStore)
    debug('Services initialized with DI container')

    const { app, sessionMiddleware } = createAppAsync(appConfig)
    const server = createServer(app)
    const cfgForIO = appConfig as unknown as {
      getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean }
    }
    const io = configureSocketIO(server, sessionMiddleware, cfgForIO)
    
    // Pass services to socket initialization
    initSocket(io as Parameters<typeof initSocket>[0], appConfig, SSHConnection as SSHCtor, services, store)
    
    startServer(server, appConfig)
    debug('Server initialized asynchronously')
    return { server, io, app, config: appConfig, services }
  } catch (err) {
    if (err instanceof Error) {
      handleError(err)
    } else {
      handleError(new Error(String(err)))
    }
    process.exit(1)
  }
}
