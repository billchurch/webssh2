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

interface ErrorDetails {
  message: string
  code?: string
  level?: string
}

const NETWORK_CODE_PATTERNS = ['econnrefused', 'enotfound'] as const
const TIMEOUT_CODE_PATTERNS = ['etimedout', 'timeout'] as const
const AUTH_CODE_PATTERNS = ['auth'] as const

const AUTH_MESSAGE_PATTERNS = ['authentication', 'permission', 'denied'] as const
const TIMEOUT_MESSAGE_PATTERNS = ['timeout', 'timed out'] as const
const NETWORK_MESSAGE_PATTERNS = ['refused', 'network', 'unreachable'] as const
const CONNECTION_MESSAGE_PATTERNS = ['connection'] as const

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

function extractErrorDetails(err: unknown): ErrorDetails {
  const errorObj = err as { code?: string; level?: string }
  const message = extractErrorMessage(err).toLowerCase()
  const code = typeof errorObj.code === 'string' ? errorObj.code.toLowerCase() : undefined
  const level = typeof errorObj.level === 'string' ? errorObj.level : undefined

  const details: ErrorDetails = { message }
  if (code !== undefined) {
    details.code = code
  }
  if (level !== undefined) {
    details.level = level
  }
  return details
}

function matchesPattern(value: string | undefined, patterns: readonly string[]): boolean {
  if (value === undefined) {
    return false
  }
  return patterns.some(pattern => value.includes(pattern))
}

function messageContains(message: string, patterns: readonly string[]): boolean {
  return patterns.some(pattern => message.includes(pattern))
}

/**
 * Categorize SSH error based on error properties
 * Pure function - no side effects
 */
export function categorizeError(err: unknown): SshErrorType {
  if (err == null) {
    return SshErrorType.UNKNOWN
  }
  const details = extractErrorDetails(err)

  if (matchesPattern(details.code, NETWORK_CODE_PATTERNS) ||
      messageContains(details.message, NETWORK_MESSAGE_PATTERNS)) {
    return SshErrorType.NETWORK
  }

  if (matchesPattern(details.code, TIMEOUT_CODE_PATTERNS) ||
      messageContains(details.message, TIMEOUT_MESSAGE_PATTERNS)) {
    return SshErrorType.TIMEOUT
  }

  if (matchesPattern(details.code, AUTH_CODE_PATTERNS) ||
      messageContains(details.message, AUTH_MESSAGE_PATTERNS) ||
      details.level === 'client-authentication') {
    return SshErrorType.AUTHENTICATION
  }

  if (messageContains(details.message, CONNECTION_MESSAGE_PATTERNS)) {
    return SshErrorType.CONNECTION
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
