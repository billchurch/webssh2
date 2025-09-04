// server
// app/app.js

import express from 'express'
import config, { getConfig } from './config.js'
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
 * @param {Object} appConfig - Configuration object
 * @returns {Promise<Object>} An object containing the app and sessionMiddleware
 */
function createAppAsync(appConfig) {
  const app = express()

  try {
    // Resolve the correct path to the webssh2_client module
    const clientPath = getClientPublicPath()

    // Apply middleware
    const { sessionMiddleware } = applyMiddleware(app, appConfig)

    // Create routes with the config
    const sshRoutes = createRoutes(appConfig)

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
 * Creates and configures the Express application (sync version for backward compatibility)
 * @returns {Object} An object containing the app and sessionMiddleware
 * @deprecated Use initializeServerAsync instead
 */
function createApp() {
  const sshRoutes = createRoutes(config)
  const app = express()

  try {
    // Resolve the correct path to the webssh2_client module
    const clientPath = getClientPublicPath()

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
 * Initializes and starts the server asynchronously
 * @returns {Promise<Object>} An object containing the server, io, and app instances
 */
async function initializeServerAsync() {
  try {
    // Get configuration asynchronously
    const appConfig = await getConfig()
    debug('Configuration loaded asynchronously')

    const { app, sessionMiddleware } = createAppAsync(appConfig)
    const server = createServer(app)
    const io = configureSocketIO(server, sessionMiddleware, appConfig)

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

/**
 * Initializes and starts the server (sync version for backward compatibility)
 * @returns {Object} An object containing the server, io, and app instances
 * @deprecated Use initializeServerAsync instead
 */
function initializeServer() {
  try {
    const { app, sessionMiddleware } = createApp()
    const server = createServer(app)
    const io = configureSocketIO(server, sessionMiddleware, config)

    // Set up Socket.IO listeners
    socketHandler(io, config, SSHConnection)

    // Start the server
    startServer(server, config)

    debug('Server initialized')

    return { server: server, io: io, app: app }
  } catch (err) {
    handleError(err)
    process.exit(1)
  }
}

export { initializeServer, initializeServerAsync, createApp, createAppAsync, config }
