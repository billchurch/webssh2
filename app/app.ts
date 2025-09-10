// server
// app/app.ts

import express, { type Express } from 'express'
import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { getConfig } from './config.js'
import SSHConnection from './ssh.js'
import socketHandler from './socket.js'
import { createRoutes } from './routes.js'
import { applyMiddleware } from './middleware.js'
import { createServer, startServer } from './server.js'
import { configureSocketIO } from './io.js'
import { handleError, ConfigError } from './errors.js'
import { createNamespacedDebug } from './logger.js'
import { MESSAGES } from './constants.js'
import { getClientPublicPath } from './client-path.js'
import type { WebSSH2Config } from './types/config.js'
import type { SSHConnectionClass, WebSSH2Server } from './types/socket.js'

const debug = createNamespacedDebug('app')

interface AppResult {
  app: Express
  sessionMiddleware: express.RequestHandler
}

interface ServerResult {
  server: HTTPServer
  io: SocketIOServer
  app: Express
  config: WebSSH2Config
}

/**
 * Creates and configures the Express application (async version)
 * @param appConfig - Configuration object
 * @returns An object containing the app and sessionMiddleware
 */
function createAppAsync(appConfig: WebSSH2Config): AppResult {
  const app = express()

  try {
    // Resolve the correct path to the webssh2_client module
    const clientPath = getClientPublicPath()

    // Apply middleware
    const { sessionMiddleware } = applyMiddleware(app, {
      user: appConfig.user,
      session: {
        secret: appConfig.session?.secret || 'webssh2-secret',
        name: 'webssh2-session'
      },
      sso: {
        enabled: false
      }
    })

    // Create routes with the config
    const sshRoutes = createRoutes(appConfig)

    // Serve static files from the webssh2_client module with a custom prefix
    app.use('/ssh/assets', express.static(clientPath))

    // Use the SSH routes
    app.use('/ssh', sshRoutes)

    return { app: app, sessionMiddleware: sessionMiddleware }
  } catch (err) {
    const error = err as Error
    throw new ConfigError(`${MESSAGES.EXPRESS_APP_CONFIG_ERROR}: ${error.message}`)
  }
}

/**
 * Initializes and starts the server asynchronously
 * @returns An object containing the server, io, and app instances
 */
async function initializeServerAsync(): Promise<ServerResult> {
  try {
    // Get configuration asynchronously
    const appConfig = await getConfig()
    debug('Configuration loaded asynchronously')

    const { app, sessionMiddleware } = createAppAsync(appConfig)
    const server = createServer(app)
    const io = configureSocketIO(server, sessionMiddleware, {
      getCorsConfig: () => ({
        origin: appConfig.http.origins,
        methods: ['GET', 'POST'],
        credentials: true
      })
    })

    // Set up Socket.IO listeners
    socketHandler(io as unknown as WebSSH2Server, appConfig, SSHConnection as unknown as SSHConnectionClass)

    // Start the server
    startServer(server, appConfig)

    debug('Server initialized asynchronously')

    return { server: server, io: io, app: app, config: appConfig }
  } catch (err) {
    handleError(err as Error)
    process.exit(1)
  }
}

export { initializeServerAsync, createAppAsync }