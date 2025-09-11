// server
// app/app.js

import express from 'express'
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
 * Creates and configures the Express application (sync)
 * @param {import('./types/config.js').Config} appConfig - Configuration object
 * @returns {{ app: import('express').Application, sessionMiddleware: import('express').RequestHandler }}
 */
function createAppAsync(appConfig) {
  const app = express()

  try {
    // Resolve the correct path to the webssh2_client module
    const clientPath = getClientPublicPath()

    // Apply middleware
    const _mw = /** @type {{ sessionMiddleware: import('express').RequestHandler }} */ (
      applyMiddleware(app, appConfig)
    )
    const { sessionMiddleware } = _mw

    // Create routes with the config
    const sshRoutes = createRoutes(appConfig)

    // Serve static files from the webssh2_client module with a custom prefix
    app.use('/ssh/assets', express.static(clientPath))

    // Use the SSH routes
    app.use('/ssh', sshRoutes)

    return { app: app, sessionMiddleware: sessionMiddleware }
  } catch (err) {
    const message = err && typeof err === 'object' && 'message' in err ? err.message : String(err)
    throw new ConfigError(`${MESSAGES.EXPRESS_APP_CONFIG_ERROR}: ${message}`)
  }
}

/**
 * Initializes and starts the server asynchronously
 * @returns {Promise<{ server: import('node:http').Server, io: import('socket.io').Server, app: import('express').Application, config: import('./types/config.js').Config }>}
 */
async function initializeServerAsync() {
  try {
    // Get configuration asynchronously
    const appConfig = await getConfig()
    debug('Configuration loaded asynchronously')

    const { app, sessionMiddleware } = createAppAsync(appConfig)
    const server = createServer(app)
    // Socket.IO expects a config that exposes getCorsConfig(); getConfig attaches it at load time
    /** @type {{ getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean } }} */
    const cfgForIO = appConfig
    const io = configureSocketIO(server, /** @type {any} */ (sessionMiddleware), cfgForIO)

    // Set up Socket.IO listeners
    socketHandler(io, appConfig, SSHConnection)

    // Start the server
    startServer(server, appConfig)

    debug('Server initialized asynchronously')

    return { server: server, io: io, app: app, config: appConfig }
  } catch (err) {
    if (err instanceof Error) {
      handleError(err)
    } else {
      handleError(new Error(String(err)))
    }
    process.exit(1)
  }
}

export { initializeServerAsync, createAppAsync }
