#!/usr/bin/env node

// server
// index.js
/**
 * index.js
 *
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch/WebSSH2 - May 2017
 */

import { initializeServer, initializeServerAsync } from './app/app.js'
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

/**
 * Main function to start the application (sync version for backward compatibility)
 * @deprecated Use mainAsync instead
 */
function main() {
  debug('Starting WebSSH2 server with sync initialization...')
  initializeServer()
}

// Determine which initialization method to use based on environment
// Default to async for modern Node.js applications
const useAsyncInit = process.env.WEBSSH_USE_ASYNC_INIT !== 'false'

if (useAsyncInit) {
  // Use async initialization by default
  mainAsync()
} else {
  // Fall back to sync initialization if explicitly requested
  main()
}

// For testing purposes, export both functions
export { initializeServer, initializeServerAsync, main, mainAsync }