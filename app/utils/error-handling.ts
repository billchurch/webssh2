// app/utils/error-handling.ts
// Shared error handling utilities

/**
 * Extract a readable error message from any error type
 * @param error - The error to extract message from
 * @param defaultMessage - Default message if extraction fails
 * @returns Error message string
 */
export function extractErrorMessage(error: unknown, defaultMessage = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error != null && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return defaultMessage
}

/**
 * Create a standardized error result
 * @param error - The error that occurred
 * @param context - Optional context for the error
 * @returns Standardized error result
 */
export function createErrorResult<T = never>(
  error: unknown,
  context?: string
): { success: false; error: string; context?: string; data?: T } {
  const errorMessage = extractErrorMessage(error)
  const result: { success: false; error: string; context?: string; data?: T } = {
    success: false,
    error: errorMessage,
  }
  
  if (context != null) {
    result.context = context
  }
  
  return result
}

/**
 * Create a standardized success result
 * @param data - The successful result data
 * @returns Standardized success result
 */
export function createSuccessResult<T>(data: T): { success: true; data: T; error?: never } {
  return {
    success: true,
    data,
  }
}

/**
 * Type guard to check if a result is successful
 * @param result - The result to check
 * @returns True if the result is successful
 */
export function isSuccessResult<T>(
  result: { success: boolean; data?: T; error?: string }
): result is { success: true; data: T } {
  return result.success === true && result.data !== undefined
}

/**
 * Type guard to check if a result is an error
 * @param result - The result to check
 * @returns True if the result is an error
 */
export function isErrorResult(
  result: { success: boolean; error?: string }
): result is { success: false; error: string } {
  return result.success === false && result.error !== undefined
}