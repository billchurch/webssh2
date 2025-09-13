// app/socket/replay-handler.ts
// Credential replay handler for WebSocket connections

import type { Socket } from 'socket.io'
import { createNamespacedDebug } from '../logger.js'
import type { Credentials } from '../validation/credentials.js'
import type { Config } from '../types/config.js'

const debug = createNamespacedDebug('socket:replay')

export interface ReplaySession {
  sshCredentials?: Partial<Credentials>
  allowReplay?: boolean
  allowReconnect?: boolean
  replayCRLF?: boolean
}

/**
 * Check if credential replay is allowed
 * @param session - User session
 * @param config - Application configuration
 * @returns true if replay is allowed
 * @pure
 */
export function isReplayAllowed(
  session: ReplaySession,
  config: Config
): boolean {
  if (!config.options.allowReplay) {
    debug('Replay disabled in config')
    return false
  }
  
  if (!session.allowReplay) {
    debug('Replay not allowed for session')
    return false
  }
  
  if (!session.sshCredentials) {
    debug('No credentials to replay')
    return false
  }
  
  return true
}

/**
 * Get credentials for replay
 * @param session - User session
 * @returns Credentials or null if not available
 * @pure
 */
export function getReplayCredentials(
  session: ReplaySession
): Partial<Credentials> | null {
  if (!session.sshCredentials) {
    return null
  }
  
  return {
    ...session.sshCredentials,
  }
}

/**
 * Check if reconnection is allowed
 * @param session - User session
 * @param config - Application configuration
 * @returns true if reconnection is allowed
 * @pure
 */
export function isReconnectAllowed(
  session: ReplaySession,
  config: Config
): boolean {
  return config.options.allowReconnect === true && 
         session.allowReconnect === true
}

/**
 * Get CRLF setting for replay
 * @param session - User session
 * @param config - Application configuration
 * @returns true if CRLF should be used
 * @pure
 */
export function getReplayCRLF(
  session: ReplaySession,
  config: Config
): boolean {
  return session.replayCRLF === true || 
         config.options.replayCRLF === true
}