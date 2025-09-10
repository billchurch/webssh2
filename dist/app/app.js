// server
// app/app.ts
import express from 'express'
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
const debug = createNamespacedDebug('app')
/**
 * Creates and configures the Express application (async version)
 * @param appConfig - Configuration object
 * @returns An object containing the app and sessionMiddleware
 */
function createAppAsync(appConfig) {
  const app = express()
  try {
    // Resolve the correct path to the webssh2_client module
    const clientPath = getClientPublicPath()
    // Apply middleware
    const { sessionMiddleware } = applyMiddleware(app, {
      user: appConfig.user,
      session: {
        secret: appConfig.session?.secret || 'webssh2-secret',
        name: 'webssh2-session',
      },
      sso: {
        enabled: false,
      },
    })
    // Create routes with the config
    const sshRoutes = createRoutes(appConfig)
    // Serve static files from the webssh2_client module with a custom prefix
    app.use('/ssh/assets', express.static(clientPath))
    // Use the SSH routes
    app.use('/ssh', sshRoutes)
    return { app: app, sessionMiddleware: sessionMiddleware }
  } catch (err) {
    const error = err
    throw new ConfigError(`${MESSAGES.EXPRESS_APP_CONFIG_ERROR}: ${error.message}`)
  }
}
/**
 * Initializes and starts the server asynchronously
 * @returns An object containing the server, io, and app instances
 */
async function initializeServerAsync() {
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
        credentials: true,
      }),
    })
    // Set up Socket.IO listeners
    socketHandler(io, appConfig, SSHConnection)
    // Start the server
    startServer(server, appConfig)
    debug('Server initialized asynchronously')
    return { server: server, io: io, app: app, config: appConfig }
  } catch (err) {
    handleError(err)
    process.exit(1)
  }
}
export { initializeServerAsync, createAppAsync }
//# sourceMappingURL=app.js.map
