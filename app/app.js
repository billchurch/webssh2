// server
// app/app.js
'use strict'

const http = require('http')
const express = require('express')
const socketIo = require('socket.io')
const path = require('path')
const bodyParser = require('body-parser')
const config = require('./config')
const socketHandler = require('./socket')
const sshRoutes = require('./routes')

/**
 * Creates and configures the Express application
 * @returns {express.Application} The Express application instance
 */
function createApp() {
  var app = express();

  // Resolve the correct path to the webssh2_client module
  var clientPath = path.resolve(__dirname, '..', 'node_modules', 'webssh2_client', 'client', 'public');

  // Handle POST and GET parameters
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // Serve static files from the webssh2_client module with a custom prefix
  app.use('/ssh/assets', express.static(clientPath));

  // Use the SSH routes
  app.use('/ssh', sshRoutes);

  return app;
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
 * @returns {import('socket.io').Server} The Socket.IO server instance
 */
function configureSocketIO(server) {
  return socketIo(server, {
    path: '/ssh/socket.io',
    cors: getCorsConfig()
  })
}

/**
 * Gets the CORS configuration
 * @returns {Object} The CORS configuration object
 */
function getCorsConfig() {
  return {
    origin: config.origin || ['*.*'],
    methods: ['GET', 'POST'],
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
  const app = createApp()
  const server = createServer(app)
  const io = configureSocketIO(server)

  // Set up Socket.IO listeners
  setupSocketIOListeners(io)

  // Start the server
  server.listen(config.listen.port, config.listen.ip, () => {
    console.log(`WebSSH2 service listening on ${config.listen.ip}:${config.listen.port}`)
  })

  server.on('error', handleServerError)

  return { server, io, app }
}

/**
 * Handles server errors
 * @param {Error} err - The error object
 */
function handleServerError(err) {
  console.error('WebSSH2 server.listen ERROR:', err.code)
}

// Don't start the server immediately, export the function instead
module.exports = { startServer, config }