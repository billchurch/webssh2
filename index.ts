#!/usr/bin/env node

// server
// index.ts (dev entry for tsx)
import { initializeServerAsync } from './app/app.js'
import { createNamespacedDebug } from './app/logger.js'
import { handleError } from './app/errors.js'

export { initializeServerAsync } from './app/app.js'

const debug = createNamespacedDebug('main')

try {
  debug('Starting WebSSH2 server with async initialization...')
  const { config } = await initializeServerAsync()

  // Log startup verification with algorithm summary
  debug('WebSSH2 server started with config', {
    listenPort: config.listen.port,
    listenIp: config.listen.ip,
    algorithms: {
      kex: config.ssh.algorithms.kex.slice(0, 3).join(',') + (config.ssh.algorithms.kex.length > 3 ? '...' : ''),
      hmac: config.ssh.algorithms.hmac.slice(0, 3).join(',') + (config.ssh.algorithms.hmac.length > 3 ? '...' : ''),
      cipher: config.ssh.algorithms.cipher.slice(0, 3).join(',') + (config.ssh.algorithms.cipher.length > 3 ? '...' : ''),
      serverHostKey: config.ssh.algorithms.serverHostKey.slice(0, 3).join(',') + (config.ssh.algorithms.serverHostKey.length > 3 ? '...' : '')
    }
  })
  debug('WebSSH2 server started successfully')
} catch (err) {
  debug('Failed to start server: %s', (err as Error).message)
  handleError(err as Error)
  process.exit(1)
}
