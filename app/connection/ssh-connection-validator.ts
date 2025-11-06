// app/connection/ssh-connection-validator.ts
// SSH connection validation service

import { randomUUID } from 'node:crypto'
import { createNamespacedDebug } from '../logger.js'
import { analyzeConnectionError } from './ssh-validator.js'
import type { Config } from '../types/config.js'
import type { SSHService, SSHConfig } from '../services/interfaces.js'
import { getGlobalContainer } from '../services/setup.js'
import { TOKENS } from '../services/container.js'
import { createSessionId } from '../types/branded.js'
import { evaluateAuthMethodPolicy } from '../auth/auth-method-policy.js'
import { VALIDATION_MESSAGES } from '../constants/index.js'

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
 * @param password - SSH password (optional if privateKey is provided)
 * @param config - Application configuration
 * @param privateKey - SSH private key (optional if password is provided)
 * @param passphrase - Passphrase for encrypted private key (optional)
 * @returns Validation result with error details if failed
 */
export async function validateSshCredentials(
  host: string,
  port: number,
  username: string,
  password: string | undefined,
  config: Config,
  privateKey?: string,
  passphrase?: string
): Promise<SshValidationResult> {
  debug(`Validating SSH credentials for ${username}@${host}:${port}`)

  const policyResult = evaluateAuthMethodPolicy(config.ssh.allowedAuthMethods, {
    password,
    privateKey
  })

  if (!policyResult.ok) {
    debug('Policy denied authentication method: %s', policyResult.error.method)
    return {
      success: false,
      errorType: 'auth',
      errorMessage: VALIDATION_MESSAGES.AUTH_METHOD_DISABLED
    }
  }

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

  const sessionId = createSessionId(randomUUID())

  const sshConfig: SSHConfig = {
    sessionId,
    host,
    port,
    username
  }

  // Add authentication method
  if (password !== undefined && password !== '') {
    sshConfig.password = password
  }

  if (privateKey !== undefined && privateKey !== '') {
    sshConfig.privateKey = privateKey

    if (passphrase !== undefined && passphrase !== '') {
      sshConfig.passphrase = passphrase
    }
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
