#!/usr/bin/env node

// server
// index.js
/**
 * index.js
 *
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch/WebSSH2 - May 2017
 */

const { initializeServer } = require("./app/app")

/**
 * Main function to start the application
 */
function main() {
  initializeServer()
}

// Run the application
main()

// For testing purposes, export the functions
module.exports = {
  initializeServer
}
