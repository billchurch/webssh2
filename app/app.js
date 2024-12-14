// server
// app/app.js

import express from 'express'
import config from './config.js'
import socketHandler from './socket.js'
import { createRoutes } from './routes.js'
import { applyMiddleware } from './middleware.js'
import { createServer, startServer } from './server.js'
import { configureSocketIO } from './io.js'
import { handleError, ConfigError } from './errors.js'
import { createNamespacedDebug } from './logger.js'
import { DEFAULTS, MESSAGES } from './constants.js'

const debug = createNamespacedDebug('app')
const sshRoutes = createRoutes(config)

/**
 * Creates and configures the Express application
 * @returns {Object} An object containing the app and sessionMiddleware
 */
function createApp() {
  const app = express()

  try {
    // Resolve the correct path to the webssh2_client module
    const clientPath = DEFAULTS.WEBSSH2_CLIENT_PATH

    // Apply middleware
    const { sessionMiddleware } = applyMiddleware(app, config)

    // Serve static files from the webssh2_client module with a custom prefix
    app.use('/ssh/assets', express.static(clientPath))

    // Use the SSH routes
    app.use('/ssh', sshRoutes)

    return { app: app, sessionMiddleware: sessionMiddleware }
  } catch (err) {
    throw new ConfigError(`${MESSAGES.EXPRESS_APP_CONFIG_ERROR}: ${err.message}`)
  }
}

/**
 * Initializes and starts the server
 * @returns {Object} An object containing the server, io, and app instances
 */
function initializeServer() {
  try {
    const { app, sessionMiddleware } = createApp()
    const server = createServer(app)
    const io = configureSocketIO(server, sessionMiddleware, config)

    // Set up Socket.IO listeners
    socketHandler(io, config)

    // Start the server
    startServer(server, config)

    debug('Server initialized')

    return { server: server, io: io, app: app }
  } catch (err) {
    handleError(err)
    process.exit(1)
  }
}

export { initializeServer, config }
