// server
// app/app.js

const express = require("express")
const path = require("path")
const config = require("./config")
const socketHandler = require("./socket")
const sshRoutes = require("./routes")
const { applyMiddleware } = require("./middleware")
const { createServer, startServer } = require("./server")
const { configureSocketIO } = require("./io")
const { handleError, ConfigError } = require("./errors")
const { createNamespacedDebug } = require("./logger")

const debug = createNamespacedDebug("app")

/**
 * Creates and configures the Express application
 * @returns {Object} An object containing the app and sessionMiddleware
 */
function createApp() {
  const app = express()

  try {
    // Resolve the correct path to the webssh2_client module
    const clientPath = path.resolve(
      __dirname,
      "..",
      "node_modules",
      "webssh2_client",
      "client",
      "public"
    )

    // Apply middleware
    const { sessionMiddleware } = applyMiddleware(app, config)

    // Serve static files from the webssh2_client module with a custom prefix
    app.use("/ssh/assets", express.static(clientPath))

    // Use the SSH routes
    app.use("/ssh", sshRoutes)

    return { app: app, sessionMiddleware: sessionMiddleware }
  } catch (err) {
    throw new ConfigError(`Failed to configure Express app: ${err.message}`)
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

    debug("Server initialized")

    return { server: server, io: io, app: app }
  } catch (err) {
    handleError(err)
    process.exit(1)
  }
}

module.exports = { initializeServer: initializeServer, config: config }
