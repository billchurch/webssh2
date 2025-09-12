// server
// app/client-path.js

import webssh2Client from 'webssh2_client'
import { DEFAULTS } from './constants.js'
import { createNamespacedDebug } from './logger.js'

const debug = createNamespacedDebug('client-path')

/**
 * Resolve the public path for the webssh2_client assets.
 * Prefers module API, falls back to DEFAULTS.WEBSSH2_CLIENT_PATH.
 * @returns {string} absolute path to client public assets
 */
export function getClientPublicPath() {
  try {
    const p = webssh2Client.getPublicPath()
    return p
  } catch (err) {
    debug('Falling back to DEFAULTS.WEBSSH2_CLIENT_PATH:', err?.message)
    return DEFAULTS.WEBSSH2_CLIENT_PATH
  }
}
