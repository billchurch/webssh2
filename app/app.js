// app/app.js
'use strict'

const http = require('http')
const socketIo = require('socket.io')
const config = require('./config')
const socketHandler = require('./socket')

/**
 * Creates and configures the HTTP server
 * @returns {http.Server} The HTTP server instance
 */
function createServer() {
  return http.createServer()
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
 * Handles a new Socket.IO connection
 * @param {import('socket.io').Socket} socket - The Socket.IO socket
 */
function handleConnection(socket) {
  logNewConnection(socket)
  setupDisconnectListener(socket)
}

/**
 * Logs information about a new connection
 * @param {import('socket.io').Socket} socket - The Socket.IO socket
 */
function logNewConnection(socket) {
  console.log(
    'New connection:',
    socket.id,
    'Transport:',
    socket.conn.transport.name
  )
}

/**
 * Sets up the disconnect listener for a socket
 * @param {import('socket.io').Socket} socket - The Socket.IO socket
 */
function setupDisconnectListener(socket) {
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, reason)
  })
}

// Create and configure the server
const server = createServer()
const io = configureSocketIO(server)

// Set up Socket.IO listeners
setupSocketIOListeners(io)

// Log the config object to verify its contents

module.exports = { server, config, io }