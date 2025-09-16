// app/utils/error-handler.ts
// Centralized error handling utilities

import type { Result } from '../types/result.js'
import { err, ok } from '../types/result.js'
import { createNamespacedDebug } from '../logger.js'

const debug = createNamespacedDebug('error-handler')

/**
 * Standard error types
 */
export enum ErrorType {
  Validation = 'validation',
  Authentication = 'authentication',
  Network = 'network',
  Timeout = 'timeout',
  Permission = 'permission',
  Configuration = 'configuration',
  NotFound = 'not-found',
  Conflict = 'conflict',
  RateLimit = 'rate-limit',
  Internal = 'internal',
  Unknown = 'unknown',
}

/**
 * Standard error with type information
 */
export interface TypedError extends Error {
  readonly type: ErrorType
  readonly code?: string
  readonly statusCode?: number
  readonly details?: unknown
  readonly recoverable?: boolean
}

/**
 * Create a typed error
 */
export function createTypedError(
  message: string,
  type: ErrorType = ErrorType.Unknown,
  options?: {
    code?: string
    statusCode?: number
    details?: unknown
    recoverable?: boolean
  }
): TypedError {
  const error = new Error(message) as TypedError
  Object.assign(error, {
    type,
    code: options?.code,
    statusCode: options?.statusCode,
    details: options?.details,
    recoverable: options?.recoverable ?? false,
  })
  return error
}

/**
 * Extract error message from unknown error
 */
export function extractErrorMessage(error: unknown): string {
  if (error == null) {
    return 'Unknown error'
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>
    if (typeof e['message'] === 'string') {
      return e['message']
    }
    if (typeof e['error'] === 'string') {
      return e['error']
    }
    if (typeof e['reason'] === 'string') {
      return e['reason']
    }
    if (typeof e['code'] === 'string') {
      return e['code']
    }
  }
  
  try {
    return JSON.stringify(error)
  } catch {
    return '[object]'
  }
}

/**
 * Extract error code from unknown error
 */
export function extractErrorCode(error: unknown): string | undefined {
  if (error == null) {
    return undefined
  }
  
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>
    if (typeof e['code'] === 'string') {
      return e['code']
    }
    if (typeof e['errno'] === 'string') {
      return e['errno']
    }
    if (typeof e['syscall'] === 'string') {
      return e['syscall']
    }
  }
  
  return undefined
}

/**
 * Classify error type from error object
 */
export function classifyErrorType(error: unknown): ErrorType {
  const message = extractErrorMessage(error).toLowerCase()
  const code = extractErrorCode(error)?.toLowerCase()
  
  // Check for typed errors first
  if (error != null && typeof error === 'object' && 'type' in error) {
    const typedError = error as { type?: unknown }
    if (typeof typedError.type === 'string') {
      return typedError.type as ErrorType
    }
  }
  
  // Network errors
  if (
    code === 'econnrefused' ||
    code === 'econnreset' ||
    code === 'enotfound' ||
    code === 'enetunreach' ||
    code === 'ehostunreach' ||
    message.includes('connect') ||
    message.includes('network')
  ) {
    return ErrorType.Network
  }
  
  // Timeout errors
  if (
    code === 'etimedout' ||
    code === 'timeout' ||
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return ErrorType.Timeout
  }
  
  // Authentication errors
  if (
    code === 'eauth' ||
    message.includes('auth') ||
    message.includes('password') ||
    message.includes('credential') ||
    message.includes('permission denied')
  ) {
    return ErrorType.Authentication
  }
  
  // Permission errors
  if (
    code === 'eacces' ||
    code === 'eperm' ||
    message.includes('permission') ||
    message.includes('access denied')
  ) {
    return ErrorType.Permission
  }
  
  // Validation errors
  if (
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('must be') ||
    message.includes('validation')
  ) {
    return ErrorType.Validation
  }
  
  // Not found errors
  if (
    code === 'enoent' ||
    message.includes('not found') ||
    message.includes('does not exist')
  ) {
    return ErrorType.NotFound
  }
  
  // Configuration errors
  if (
    message.includes('config') ||
    message.includes('setting') ||
    message.includes('option')
  ) {
    return ErrorType.Configuration
  }
  
  return ErrorType.Unknown
}

/**
 * Convert error type to HTTP status code
 */
export function errorTypeToStatusCode(type: ErrorType): number {
  switch (type) {
    case ErrorType.Validation:
      return 400 // Bad Request
    case ErrorType.Authentication:
      return 401 // Unauthorized
    case ErrorType.Permission:
      return 403 // Forbidden
    case ErrorType.NotFound:
      return 404 // Not Found
    case ErrorType.Conflict:
      return 409 // Conflict
    case ErrorType.RateLimit:
      return 429 // Too Many Requests
    case ErrorType.Network:
      return 502 // Bad Gateway
    case ErrorType.Timeout:
      return 504 // Gateway Timeout
    case ErrorType.Configuration:
    case ErrorType.Internal:
    case ErrorType.Unknown:
    default:
      return 500 // Internal Server Error
  }
}

/**
 * Convert SSH error type to standard error type
 */
export function sshErrorTypeToErrorType(sshType: string): ErrorType {
  switch (sshType) {
    case 'auth':
      return ErrorType.Authentication
    case 'network':
      return ErrorType.Network
    case 'timeout':
      return ErrorType.Timeout
    case 'permission':
      return ErrorType.Permission
    case 'protocol':
      return ErrorType.Validation
    default:
      return ErrorType.Unknown
  }
}

/**
 * Wrap function execution in try-catch and return Result
 */
export function tryExecute<T>(
  fn: () => T,
  errorType?: ErrorType
): Result<T, TypedError> {
  try {
    return ok(fn())
  } catch (error) {
    const message = extractErrorMessage(error)
    const type = errorType ?? classifyErrorType(error)
    const code = extractErrorCode(error)
    return err(createTypedError(message, type, {
      ...(code != null && { code }),
      details: error,
    }))
  }
}

/**
 * Wrap async function execution in try-catch and return Result
 */
export async function tryExecuteAsync<T>(
  fn: () => Promise<T>,
  errorType?: ErrorType
): Promise<Result<T, TypedError>> {
  try {
    const value = await fn()
    return ok(value)
  } catch (error) {
    const message = extractErrorMessage(error)
    const type = errorType ?? classifyErrorType(error)
    const code = extractErrorCode(error)
    return err(createTypedError(message, type, {
      ...(code != null && { code }),
      details: error,
    }))
  }
}

/**
 * Log error with context
 */
export function logError(
  context: string,
  error: unknown,
  details?: Record<string, unknown>
): void {
  const message = extractErrorMessage(error)
  const code = extractErrorCode(error)
  const type = classifyErrorType(error)
  
  debug('%s: %s (type: %s, code: %s)', context, message, type, code ?? 'none')
  
  if (details != null) {
    debug('%s: details: %O', context, details)
  }
  
  // Log stack trace for internal errors
  if (type === ErrorType.Internal && error instanceof Error && error.stack != null) {
    debug('%s: stack: %s', context, error.stack)
  }
}

/**
 * Create error response object
 */
export interface ErrorResponse {
  readonly error: {
    readonly message: string
    readonly type: ErrorType
    readonly code?: string
    readonly statusCode: number
    readonly timestamp: Date
    readonly details?: unknown
  }
}

/**
 * Format error for API response
 */
export function formatErrorResponse(
  error: unknown,
  includeDetails = false
): ErrorResponse {
  const message = extractErrorMessage(error)
  const type = classifyErrorType(error)
  const code = extractErrorCode(error)
  const statusCode = errorTypeToStatusCode(type)
  
  return {
    error: {
      message,
      type,
      ...(code != null && { code }),
      statusCode,
      timestamp: new Date(),
      ...(includeDetails && { details: error }),
    }
  }
}

/**
 * Error recovery strategies
 */
export interface RecoveryStrategy {
  readonly maxAttempts: number
  readonly delay: number
  readonly backoff?: number
  readonly shouldRetry: (error: unknown, attempt: number) => boolean
}

/**
 * Default recovery strategy
 */
export const defaultRecoveryStrategy: RecoveryStrategy = {
  maxAttempts: 3,
  delay: 1000,
  backoff: 2,
  shouldRetry: (error, attempt) => {
    const type = classifyErrorType(error)
    // Retry network and timeout errors
    return attempt < 3 && (
      type === ErrorType.Network ||
      type === ErrorType.Timeout
    )
  }
}

/**
 * Execute with retry on failure
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  strategy: RecoveryStrategy = defaultRecoveryStrategy
): Promise<Result<T, TypedError>> {
  let lastError: unknown
  
  for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
    try {
      const result = await fn()
      return ok(result)
    } catch (error) {
      lastError = error
      logError(`Attempt ${attempt} failed`, error)
      
      if (!strategy.shouldRetry(error, attempt)) {
        break
      }
      
      if (attempt < strategy.maxAttempts) {
        const delay = strategy.delay * Math.pow(strategy.backoff ?? 1, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  const message = extractErrorMessage(lastError)
  const type = classifyErrorType(lastError)
  const code = extractErrorCode(lastError)
  return err(createTypedError(message, type, {
    ...(code != null && { code }),
    details: lastError,
  }))
}