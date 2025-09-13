// app/routes/handlers/ssh-auth.handler.ts
// Handler for SSH authentication validation

import { createNamespacedDebug } from '../../logger.js'
import { maskSensitiveData } from '../../utils.js'
import { validateSshCredentials } from '../../connection/index.js'
import type { Config } from '../../types/config.js'

const debug = createNamespacedDebug('routes:ssh-auth')

export interface AuthParams {
  host: string
  port: number
  username: string
  password: string
}

export interface AuthResult {
  success: boolean
  errorType?: 'network' | 'timeout' | 'auth' | 'unknown'
  errorMessage?: string
}

/**
 * Handle SSH authentication validation
 * @param params - Authentication parameters
 * @param config - Application configuration
 * @returns Authentication result
 */
export async function handleSSHAuth(
  params: AuthParams,
  config: Config
): Promise<AuthResult> {
  debug('Validating SSH credentials:', maskSensitiveData(params))
  
  const result = await validateSshCredentials(
    params.host,
    params.port,
    params.username,
    params.password,
    config
  )
  
  debug('SSH validation result:', { 
    success: result.success, 
    errorType: result.errorType 
  })
  
  return result
}

/**
 * Determine HTTP status code based on error type
 * @param errorType - Type of SSH error
 * @returns HTTP status code
 * @pure
 */
export function getStatusCodeForError(
  errorType?: 'network' | 'timeout' | 'auth' | 'unknown'
): number {
  switch (errorType) {
    case 'auth':
      return 401 // Unauthorized
    case 'network':
      return 502 // Bad Gateway
    case 'timeout':
      return 504 // Gateway Timeout
    case 'unknown':
    case undefined:
    default:
      return 500 // Internal Server Error
  }
}

/**
 * Format error response for client
 * @param errorType - Type of SSH error
 * @param errorMessage - Detailed error message
 * @returns Formatted error response
 * @pure
 */
export function formatErrorResponse(
  errorType?: 'network' | 'timeout' | 'auth' | 'unknown',
  errorMessage?: string
): { error: string; details?: string } {
  const baseMessages = {
    auth: 'SSH authentication failed',
    network: 'Cannot connect to SSH host',
    timeout: 'SSH connection timed out',
    unknown: 'SSH connection failed',
  }
  
  const result: { error: string; details?: string } = {
    error: baseMessages[errorType ?? 'unknown'],
  }
  
  if (errorMessage != null && errorMessage !== '') {
    result.details = errorMessage
  }
  
  return result
}