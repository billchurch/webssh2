// app/routes/route-error-handler.ts
// Pure functions for route error handling

import { HTTP } from '../constants.js'

/**
 * SSH validation error types
 */
export type SshErrorType = 'auth' | 'network' | 'timeout' | 'unknown' | undefined

/**
 * SSH validation result
 */
export interface SshValidationResult {
  errorType?: SshErrorType
  errorMessage?: string
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  status: number
  headers?: Record<string, string>
  message: string
}

/**
 * Creates SSH validation error response based on error type
 * Pure function that returns response data without side effects
 */
export function createSshValidationErrorResponse(
  validationResult: SshValidationResult,
  host: string,
  port: number
): ErrorResponse {
  switch (validationResult.errorType) {
    case 'auth':
      // Authentication failed - allow re-authentication
      return {
        status: HTTP.UNAUTHORIZED,
        headers: { [HTTP.AUTHENTICATE]: HTTP.REALM },
        message: 'SSH authentication failed'
      }

    case 'network':
      // Network/connectivity issue - no point in re-authenticating
      return {
        status: 502,
        message: `Bad Gateway: Unable to connect to SSH server at ${host}:${port} - ${validationResult.errorMessage}`
      }

    case 'timeout':
      // Connection timeout
      return {
        status: 504,
        message: `Gateway Timeout: SSH connection to ${host}:${port} timed out`
      }

    case undefined:
    case 'unknown':
    default:
      // Generic SSH connection error
      return {
        status: 502,
        message: `SSH connection failed: ${validationResult.errorMessage ?? 'Unknown error'}`
      }
  }
}

/**
 * Creates a generic route error message
 * Pure function for consistent error formatting
 */
export function createRouteErrorMessage(error: Error): string {
  return `Invalid configuration: ${error.message}`
}

/**
 * Gets appropriate HTTP status code based on error message
 * Pure function that maps error patterns to status codes
 */
export function getErrorStatusCode(error: Error): number {
  const message = error.message.toLowerCase()

  // Check for specific error patterns
  if (message.includes('required')) {
    return 400 // Bad Request
  }

  if (message.includes('auth') || message.includes('unauthorized')) {
    return HTTP.UNAUTHORIZED
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return 504 // Gateway Timeout
  }

  if (message.includes('connect') || message.includes('network')) {
    return 502 // Bad Gateway
  }

  // Default to internal server error
  return 500
}