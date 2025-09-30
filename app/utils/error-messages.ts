// app/utils/error-messages.ts
// Utility functions for error message extraction

/**
 * Extracts error message from unknown error value
 * @param err - Unknown error value
 * @returns Extracted error message as string
 * @pure
 */
export function extractErrorMessage(err: unknown): string {
  if (err !== null && err !== undefined && typeof err === 'object' && 'message' in err) {
    return String(err.message)
  }
  return String(err)
}