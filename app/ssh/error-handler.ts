// app/ssh/error-handler.ts
// Pure functions for SSH error handling

/**
 * SSH error types for categorization
 */
export enum SshErrorType {
  CONNECTION = 'CONNECTION',
  AUTHENTICATION = 'AUTHENTICATION',
  TIMEOUT = 'TIMEOUT',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN'
}

/**
 * SSH error information
 */
export interface SshErrorInfo {
  type: SshErrorType
  message: string
  code?: string
  level?: string
  originalError?: unknown
}

/**
 * Extract error message from unknown error
 * Pure function - no side effects
 */
export function extractErrorMessage(err: unknown): string {
  if (err == null) {
    return '[Unknown error]'
  }
  
  if (typeof err === 'string') {
    return err
  }
  
  if (err instanceof Error) {
    return err.message !== '' ? err.message : err.toString()
  }
  
  const errorObj = err as { message?: string; code?: string; toString?: () => string }
  
  if (typeof errorObj.message === 'string' && errorObj.message !== '') {
    return errorObj.message
  }
  
  if (typeof errorObj.code === 'string' && errorObj.code !== '') {
    return errorObj.code
  }
  
  if (typeof errorObj.toString === 'function') {
    const str = errorObj.toString()
    if (str !== '[object Object]') {
      return str
    }
  }
  
  return '[Unknown error]'
}

/**
 * Categorize SSH error based on error properties
 * Pure function - no side effects
 */
export function categorizeError(err: unknown): SshErrorType {
  if (err == null) {
    return SshErrorType.UNKNOWN
  }
  
  const message = extractErrorMessage(err).toLowerCase()
  const errorObj = err as { code?: string; level?: string }
  
  // Check error code
  if (errorObj.code != null) {
    const code = errorObj.code.toLowerCase()
    
    if (code.includes('econnrefused') || code.includes('enotfound')) {
      return SshErrorType.NETWORK
    }
    
    if (code.includes('etimedout') || code.includes('timeout')) {
      return SshErrorType.TIMEOUT
    }
    
    if (code.includes('auth')) {
      return SshErrorType.AUTHENTICATION
    }
  }
  
  // Check message content
  if (message.includes('authentication') || message.includes('permission') || message.includes('denied')) {
    return SshErrorType.AUTHENTICATION
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return SshErrorType.TIMEOUT
  }

  if (message.includes('refused') || message.includes('network') || message.includes('unreachable')) {
    return SshErrorType.NETWORK
  }

  if (message.includes('connection')) {
    return SshErrorType.CONNECTION
  }
  
  // Check level for authentication errors
  if (errorObj.level === 'client-authentication') {
    return SshErrorType.AUTHENTICATION
  }
  
  return SshErrorType.UNKNOWN
}

/**
 * Create SSH error information object
 * Pure function - no side effects
 */
export function createErrorInfo(err: unknown): SshErrorInfo {
  const message = extractErrorMessage(err)
  const type = categorizeError(err)

  const info: SshErrorInfo = {
    type,
    message,
    originalError: err
  }

  if (err != null && typeof err === 'object') {
    const errorObj = err as { code?: string; level?: string }

    if (errorObj.code != null) {
      info.code = errorObj.code
    }

    if (errorObj.level != null) {
      info.level = errorObj.level
    }
  }

  return info
}

/**
 * Format error for logging
 * Pure function - no side effects
 */
export function formatErrorForLog(err: unknown): string {
  const info = createErrorInfo(err)
  
  let formatted = `[${info.type}] ${info.message}`
  
  if (info.code != null) {
    formatted += ` (code: ${info.code})`
  }
  
  if (info.level != null) {
    formatted += ` (level: ${info.level})`
  }
  
  return formatted
}

/**
 * Check if error is retryable
 * Pure function - no side effects
 */
export function isRetryableError(err: unknown): boolean {
  const info = createErrorInfo(err)
  
  // Network and timeout errors are typically retryable
  return info.type === SshErrorType.NETWORK || info.type === SshErrorType.TIMEOUT
}

/**
 * Get user-friendly error message
 * Pure function - no side effects
 */
export function getUserFriendlyMessage(err: unknown): string {
  const info = createErrorInfo(err)
  
  switch (info.type) {
    case SshErrorType.AUTHENTICATION:
      return 'SSH authentication failed. Please check your credentials.'
    
    case SshErrorType.TIMEOUT:
      return 'Connection timed out. The server may be unreachable or slow to respond.'
    
    case SshErrorType.NETWORK:
      return 'Network error. Please check your connection and the server address.'
    
    case SshErrorType.CONNECTION:
      return 'Connection failed. The SSH server may be unavailable.'
    
    case SshErrorType.UNKNOWN:
    default:
      return `SSH error: ${info.message}`
  }
}