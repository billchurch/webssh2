// app/connection/ssh-connection-validator.ts
// SSH connection validation service

import { createNamespacedDebug } from '../logger.js'
import { analyzeConnectionError } from './ssh-validator.js'
import type { Config } from '../types/config.js'
import type { SSHService, SSHConfig } from '../services/interfaces.js'
import { getGlobalContainer } from '../services/setup.js'
import { TOKENS } from '../services/container.js'
import { createSessionId } from '../types/branded.js'

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
  _config: Config
): Promise<SshValidationResult> {
  debug(`Validating SSH credentials for ${username}@${host}:${port}`)

  // Get SSHService from DI container
  const container = getGlobalContainer()
  if (container === null) {
    debug('Container not initialized, cannot validate credentials')
    return {
      success: false,
      errorType: 'unknown',
      errorMessage: 'Service container not initialized',
    }
  }

  const sshService = container.resolve<SSHService>(TOKENS.SSHService)

  // Create temporary session for validation
  const sessionId = createSessionId(`validate-${Date.now()}-${Math.random()}`)

  const sshConfig: SSHConfig = {
    sessionId,
    host,
    port,
    username,
    password,
  }

  // Attempt connection
  const result = await sshService.connect(sshConfig)

  if (result.ok) {
    debug(`SSH validation successful for ${username}@${host}:${port}`)
    // Clean up immediately
    await sshService.disconnect(result.value.id)
    return { success: true }
  }

  // Connection failed - categorize error
  const err = result.error as Error & { code?: string; level?: string }
  debug(`SSH validation failed for ${username}@${host}:${port}:`, err.message)
  debug(`Error details - code: ${err.code}, level: ${err.level}`)

  const errorType = analyzeConnectionError(err)
  debug(`Determined error type: ${errorType}`)

  return {
    success: false,
    errorType,
    errorMessage: err.message,
  }
}