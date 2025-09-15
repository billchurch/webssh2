#!/usr/bin/env node

// server
// index.ts (dev entry for tsx)
import { initializeServerAsync } from './app/app.js'
import { createNamespacedDebug } from './app/logger.js'
import { handleError } from './app/errors.js'

const debug = createNamespacedDebug('main')

async function mainAsync() {
  try {
    debug('Starting WebSSH2 server with async initialization...')
    await initializeServerAsync()
    debug('WebSSH2 server started successfully')
  } catch (err) {
    debug('Failed to start server: %s', (err as Error).message)
    handleError(err as Error)
    process.exit(1)
  }
}

mainAsync()

export { initializeServerAsync, mainAsync }

