#!/usr/bin/env node

// server
// index.js
/**
 * index.js
 *
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch/WebSSH2 - May 2017
 */

import { initializeServerAsync } from './app/app.js'
import { createNamespacedDebug } from './app/logger.js'
import { handleError } from './app/errors.js'

const debug = createNamespacedDebug('main')

/**
 * Main function to start the application asynchronously
 * Uses the new async configuration loading
 */
async function mainAsync() {
  try {
    debug('Starting WebSSH2 server with async initialization...')
    await initializeServerAsync()
    debug('WebSSH2 server started successfully')
  } catch (err) {
    debug('Failed to start server: %s', err.message)
    handleError(err)
    process.exit(1)
  }
}


// Always use async initialization
mainAsync()

// For testing purposes, export the async functions
export { initializeServerAsync, mainAsync }