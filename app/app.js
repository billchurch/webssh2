// server
// app/app.js
"use strict"

const createDebug = require("debug")
const debug = createDebug("webssh2")
const http = require("http")
const express = require("express")
const socketIo = require("socket.io")
const path = require("path")
const bodyParser = require("body-parser")
const session = require("express-session")
const sharedsession = require("express-socket.io-session")
const config = require("./config")
const socketHandler = require("./socket")
const sshRoutes = require("./routes")

/**
 * Creates and configures the Express application
 * @returns {express.Application} The Express application instance
 */
function createApp() {
  const app = express()

  // Resolve the correct path to the webssh2_client module
  const clientPath = path.resolve(
    __dirname,
    "..",
    "node_modules",
    "webssh2_client",
    "client",
    "public"
  )

  // Set up session middleware
  const sessionMiddleware = session({
    secret: config.session.secret || "webssh2_secret",
    resave: false,
    saveUninitialized: true,
    name: config.session.name || "webssh2.sid"
  })
  app.use(sessionMiddleware)

  // Handle POST and GET parameters
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())

  // Serve static files from the webssh2_client module with a custom prefix
  app.use("/ssh/assets", express.static(clientPath))

  // Use the SSH routes
  app.use("/ssh", sshRoutes)

  return { app, sessionMiddleware }
}

/**
 * Creates and configures the HTTP server
 * @param {express.Application} app - The Express application instance
 * @returns {http.Server} The HTTP server instance
 */
function createServer(app) {
  return http.createServer(app)
}

/**
 * Configures Socket.IO with the given server
 * @param {http.Server} server - The HTTP server instance
 * @param {Function} sessionMiddleware - The session middleware
 * @returns {import('socket.io').Server} The Socket.IO server instance
 */
// var io = require('socket.io')(server, { serveClient: false, path: '/ssh/socket.io', origins: config.http.origins })

function configureSocketIO(server, sessionMiddleware) {
  const io = socketIo(server, {
    serveClient: false,
    path: "/ssh/socket.io",
    pingTimeout: 60000, // 1 minute
    pingInterval: 25000, // 25 seconds
    cors: getCorsConfig()
  })

  // Share session with io sockets
  io.use(
    sharedsession(sessionMiddleware, {
      autoSave: true
    })
  )

  return io
}

/**
 * Gets the CORS configuration
 * @returns {Object} The CORS configuration object
 */
function getCorsConfig() {
  return {
    origin: config.origin || ["*.*"],
    methods: ["GET", "POST"],
    credentials: true
  }
}

/**
 * Sets up Socket.IO event listeners
 * @param {import('socket.io').Server} io - The Socket.IO server instance
 */
function setupSocketIOListeners(io) {
  socketHandler(io, config)
}

/**
 * Initializes and starts the server
 * @returns {Object} An object containing the server, io, and app instances
 */
function startServer() {
  const { app, sessionMiddleware } = createApp()
  const server = createServer(app)
  const io = configureSocketIO(server, sessionMiddleware)

  // Set up Socket.IO listeners
  setupSocketIOListeners(io)

  // Start the server
  server.listen(config.listen.port, config.listen.ip, () => {
    console.log(
      `WebSSH2 service listening on ${config.listen.ip}:${config.listen.port}`
    )
  })

  server.on("error", handleServerError)

  return { server, io, app }
}

/**
 * Handles server errors
 * @param {Error} err - The error object
 */
function handleServerError(err) {
  console.error("WebSSH2 server.listen ERROR:", err.code)
}

// Don't start the server immediately, export the function instead
module.exports = { startServer, config }
