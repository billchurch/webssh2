// app/types/result.ts
// Generic Result type for error handling

/**
 * Result type for operations that can succeed or fail
 * Following functional programming patterns for error handling
 */
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E }

/**
 * Create a successful result
 * @param value - The success value
 * @returns Success result
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

/**
 * Create an error result
 * @param error - The error
 * @returns Error result
 */
export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error }
}

/**
 * Type guard to check if a result is successful
 * @param result - The result to check
 * @returns True if the result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true
}

/**
 * Type guard to check if a result is an error
 * @param result - The result to check
 * @returns True if the result is an error
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false
}

/**
 * Map a successful result value
 * @param result - The result to map
 * @param fn - The mapping function
 * @returns Mapped result
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value))
  }
  return result
}

/**
 * Map an error result
 * @param result - The result to map
 * @param fn - The error mapping function
 * @returns Mapped result
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error))
  }
  return result
}

/**
 * Unwrap a result or provide a default value
 * @param result - The result to unwrap
 * @param defaultValue - Default value if result is an error
 * @returns The value or default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value
  }
  return defaultValue
}

/**
 * Chain result operations
 * @param result - The result to chain
 * @param fn - The chaining function
 * @returns Chained result
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value)
  }
  return result
}