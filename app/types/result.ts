// app/types/result.ts
// Result type for explicit error handling without exceptions

/**
 * Success result with value
 */
export interface Ok<T> {
  ok: true
  value: T
}

/**
 * Error result with error information
 */
export interface Err<E> {
  ok: false
  error: E
}

/**
 * Result type - either success with value or error
 */
export type Result<T, E = Error> = Ok<T> | Err<E>