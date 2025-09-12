import webssh2Client from 'webssh2_client'
import { DEFAULTS } from './constants.js'
import { createNamespacedDebug } from './logger.js'

const debug = createNamespacedDebug('client-path')

export function getClientPublicPath(): string {
  try {
    return webssh2Client.getPublicPath()
  } catch (err) {
    debug('Falling back to DEFAULTS.WEBSSH2_CLIENT_PATH:', (err as { message?: string }).message)
    return DEFAULTS.WEBSSH2_CLIENT_PATH
  }
}
