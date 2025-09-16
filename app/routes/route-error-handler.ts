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
      // Unknown error - return 502 as it's likely a connectivity issue
      return {
        status: 502,
        message: `Bad Gateway: SSH connection failed - ${validationResult.errorMessage}`
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
 * Determines HTTP status code based on error type
 * Pure function for error categorization
 */
export function getErrorStatusCode(error: Error): number {
  // Check for specific error types
  if (error.message.includes('required')) {
    return 400 // Bad Request
  }
  if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
    return HTTP.UNAUTHORIZED
  }
  if (error.message.includes('timeout')) {
    return 504 // Gateway Timeout
  }
  if (error.message.includes('connect') || error.message.includes('network')) {
    return 502 // Bad Gateway
  }
  
  // Default to internal server error
  return 500
}