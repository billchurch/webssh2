// app/socket/auth-handler.ts
// WebSocket authentication handler

import type { Socket } from 'socket.io'
import { createNamespacedDebug } from '../logger.js'
import { isValidCredentials, maskSensitiveData } from '../utils.js'
import { extractErrorMessage } from '../utils/error-handling.js'
import type { Credentials } from '../validation/credentials.js'
import type { Config } from '../types/config.js'
import SSHConnection from '../ssh.js'

const debug = createNamespacedDebug('socket:auth')

export interface AuthResult {
  success: boolean
  ssh?: SSHConnection
  error?: string
}

/**
 * Handle WebSocket authentication
 * @param socket - Socket.IO socket instance
 * @param creds - User credentials
 * @param config - Application configuration
 * @returns Authentication result
 */
export async function handleSocketAuth(
  socket: Socket,
  creds: Credentials,
  config: Config
): Promise<AuthResult> {
  debug('Authenticating socket:', socket.id)
  debug('Credentials:', maskSensitiveData(creds))
  
  if (!isValidCredentials(creds)) {
    return {
      success: false,
      error: 'Invalid credentials format',
    }
  }
  
  const ssh = new SSHConnection(config)
  
  try {
    await ssh.connect(creds as Record<string, unknown>)
    debug('SSH connection established for socket:', socket.id)
    
    return {
      success: true,
      ssh,
    }
  } catch (error) {
    const errorMessage = extractErrorMessage(error)
    debug('SSH connection failed:', errorMessage)
    
    return {
      success: false,
      error: errorMessage,
    }
  }
}