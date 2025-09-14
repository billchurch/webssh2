// app/connection/ssh-connection-validator.ts
// SSH connection validation service

import { createNamespacedDebug } from '../logger.js'
import { analyzeConnectionError } from './ssh-validator.js'
import type { Config } from '../types/config.js'
import SSHConnection from '../ssh.js'

const debug = createNamespacedDebug('connection:validator')

export interface SshValidationResult {
  success: boolean
  errorType?: 'network' | 'timeout' | 'auth' | 'unknown'
  errorMessage?: string
}

/**
 * Validate SSH credentials by attempting a connection
 * @param host - SSH host
 * @param port - SSH port
 * @param username - SSH username
 * @param password - SSH password
 * @param config - Application configuration
 * @returns Validation result with error details if failed
 */
export async function validateSshCredentials(
  host: string,
  port: number,
  username: string,
  password: string,
  config: Config
): Promise<SshValidationResult> {
  debug(`Validating SSH credentials for ${username}@${host}:${port}`)
  
  const ssh = new SSHConnection(config)
  try {
    await ssh.connect({
      host,
      port,
      username,
      password,
    })
    
    // If we get here, authentication succeeded
    ssh.end() // Clean up the connection
    debug(`SSH validation successful for ${username}@${host}:${port}`)
    return { success: true }
  } catch (error) {
    const err = error as Error & { code?: string; level?: string }
    debug(`SSH validation failed for ${username}@${host}:${port}:`, err.message)
    debug(`Error details - code: ${err.code}, level: ${err.level}`)
    
    const errorType = analyzeConnectionError(err)
    debug(`Determined error type: ${errorType}`)
    
    return {
      success: false,
      errorType,
      errorMessage: err.message,
    }
  } finally {
    // Ensure connection is always cleaned up
    ssh.end()
  }
}