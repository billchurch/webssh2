// Flip helper: runtime implementation shim for client-path
// Implement directly to avoid top-level await during dev.
import webssh2Client from 'webssh2_client'
import { DEFAULTS } from './constants.js'
import { createNamespacedDebug } from './logger.js'

const debug = createNamespacedDebug('client-path')

export function getClientPublicPath() {
  try {
    const p = webssh2Client.getPublicPath()
    return p
  } catch (err) {
    debug('Falling back to DEFAULTS.WEBSSH2_CLIENT_PATH:', err?.message)
    return DEFAULTS.WEBSSH2_CLIENT_PATH
  }
}
