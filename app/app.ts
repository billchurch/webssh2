import express, { type Application, type RequestHandler } from 'express'
import type { Server as HttpServer } from 'node:http'
import type { Server as IOServer } from 'socket.io'
import { getConfig } from './config.js'
import initSocket from './socket-v2.js'
import { createRoutesV2 as createRoutes } from './routes/routes-v2.js'
import { createTelnetRoutes } from './routes/telnet-routes.js'
import { applyMiddleware } from './middleware.js'
import { createServer, startServer } from './server.js'
import { configureSocketIO, configureTelnetNamespace } from './io.js'
import { handleError, ConfigError } from './errors.js'
import { createNamespacedDebug, applyLoggingConfiguration } from './logger.js'
import { MESSAGES } from './constants/index.js'
import { getClientPublicPath } from './client-path.js'
import type { Config } from './types/config.js'
import { initializeGlobalContainer } from './services/setup.js'
import { extractErrorMessage } from './utils/error-messages.js'
import { TOKENS } from './services/container.js'
import type { Services } from './services/interfaces.js'

const debug = createNamespacedDebug('app')

export function createAppAsync(appConfig: Config): {
  app: Application
  sessionMiddleware: RequestHandler
} {
  const app = express()
  app.disable('x-powered-by')
  try {
    const clientPath = getClientPublicPath()
    const { sessionMiddleware } = applyMiddleware(app, appConfig) as unknown as {
      sessionMiddleware: RequestHandler
    }
    const sshRoutes = createRoutes(appConfig)
    app.use('/ssh/assets', express.static(clientPath))
    app.use('/ssh', sshRoutes)

    if (appConfig.telnet?.enabled === true) {
      const telnetRoutes = createTelnetRoutes(appConfig)
      app.use('/telnet/assets', express.static(clientPath))
      app.use('/telnet', telnetRoutes)
    }

    return { app, sessionMiddleware }
  } catch (err) {
    const message = extractErrorMessage(err)
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

    applyLoggingConfiguration(appConfig.logging)

    // Initialize DI container and services
    const container = initializeGlobalContainer(appConfig)
    const services = container.resolve<Services>(TOKENS.Services)
    debug('Services initialized with DI container')

    const { app, sessionMiddleware } = createAppAsync(appConfig)
    const server = createServer(app)
    const cfgForIO = appConfig as unknown as {
      getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean }
    }
    const io = configureSocketIO(server, sessionMiddleware, cfgForIO)

    // Pass services to socket initialization (SSH)
    initSocket(io as Parameters<typeof initSocket>[0], appConfig, services, 'ssh')

    // Configure telnet namespace if enabled
    const telnetIo = configureTelnetNamespace(server, sessionMiddleware, appConfig)
    if (telnetIo !== null) {
      initSocket(telnetIo as Parameters<typeof initSocket>[0], appConfig, services, 'telnet')
      debug('Telnet Socket.IO namespace initialized')
    }

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
