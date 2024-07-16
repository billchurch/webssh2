'use strict'

/**
 * index.js
 *
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch/WebSSH2 - May 2017
 */

const { server, config } = require('./app/app')

/**
 * Starts the server
 * @param {Object} config - The server configuration
 * @param {string} config.listen.ip - The IP address to listen on
 * @param {number} config.listen.port - The port to listen on
 * @param {import('http').Server} server - The HTTP server instance
 */
function startServer(config, server) {
  server.listen(config.listen.port, config.listen.ip, () => {
    console.log(
      `WebSSH2 service listening on ${config.listen.ip}:${config.listen.port}`
    )
  })

  server.on('error', handleServerError)
}

/**
 * Handles server errors
 * @param {Error} err - The error object
 */
function handleServerError(err) {
  console.error('WebSSH2 server.listen ERROR:', err.code)
}

/**
 * Main function to start the application
 */
function main() {
  startServer(config, server)
}

// Run the application
main()

// For testing purposes, export the functions
module.exports = {
  startServer,
  handleServerError
}