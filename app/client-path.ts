import webssh2Client from 'webssh2_client'
import { DEFAULTS } from './constants.js'
import { createNamespacedDebug } from './logger.js'

const debug = createNamespacedDebug('client-path')

export function getClientPublicPath(): string {
  try {
    // Explicitly type the module to help TypeScript
    const client = webssh2Client as { getPublicPath: () => string }
    return client.getPublicPath()
  } catch (err) {
    debug('Falling back to DEFAULTS.WEBSSH2_CLIENT_PATH:', (err as { message?: string }).message)
    return DEFAULTS.WEBSSH2_CLIENT_PATH
  }
}
