/**
 * Normalize SSH error messages to ensure non-empty, meaningful error text.
 * SSH2 can emit errors with empty messages but useful codes (e.g., ECONNREFUSED).
 */
export function normalizeSSHErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown SSH error'
  }

  // 1. Use message if non-empty
  if (error.message !== '') {
    return error.message
  }

  // 2. Fall back to error code (common for network errors)
  const errorWithCode = error as { code?: string }
  if (typeof errorWithCode.code === 'string' && errorWithCode.code !== '') {
    return errorWithCode.code
  }

  // 3. Try to extract from stack trace (e.g., "AggregateError [ECONNREFUSED]")
  if (error.stack !== undefined) {
    // Match error type and optional code in brackets at start of stack
    // Examples: "AggregateError [ECONNREFUSED]" or "TypeError"
    const errorTypeMatch = /^(\w+)/.exec(error.stack)
    const errorCodeMatch = /^\w+\s\[(\w+)\]/.exec(error.stack)

    const extractedCode = errorCodeMatch?.[1]
    if (extractedCode !== undefined) {
      return extractedCode
    }

    const extractedType = errorTypeMatch?.[1]
    if (extractedType !== undefined && extractedType !== 'Error') {
      return extractedType
    }
  }

  // 4. Use error name
  if (error.name !== '' && error.name !== 'Error') {
    return error.name
  }

  return 'Connection failed'
}
