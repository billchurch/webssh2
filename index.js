#!/usr/bin/env node

// server
// index.js
/**
 * index.js
 *
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch/WebSSH2 - May 2017
 */

import { initializeServer } from "./app/app.js"

/**
 * Main function to start the application
 */
function main() {
  initializeServer()
}

// Run the application
main()

// For testing purposes, export the function
export { initializeServer }
