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

/**
 * Create a success result
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

/**
 * Create an error result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

/**
 * Check if result is success
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true
}

/**
 * Check if result is error
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false
}

/**
 * Map success value to new value
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
 * Map error to new error
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
 * Chain operations that return Results
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

/**
 * Provide alternative value on error
 */
export function orElse<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F> {
  if (isErr(result)) {
    return fn(result.error)
  }
  return result
}

/**
 * Unwrap value or throw error
 * Use only when error is truly exceptional
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value
  }
  throw new Error(`Result unwrap failed: ${JSON.stringify(result.error)}`)
}

/**
 * Unwrap value or return default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value
  }
  return defaultValue
}

/**
 * Unwrap value or compute default
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  if (isOk(result)) {
    return result.value
  }
  return fn(result.error)
}

/**
 * Convert Result to nullable value
 */
export function toNullable<T, E>(result: Result<T, E>): T | null {
  if (isOk(result)) {
    return result.value
  }
  return null
}

/**
 * Create Result from nullable value
 */
export function fromNullable<T, E>(
  value: T | null | undefined,
  error: E
): Result<T, E> {
  if (value != null) {
    return ok(value)
  }
  return err(error)
}

/**
 * Try to execute function and catch errors
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn())
  } catch (error) {
    if (mapError != null) {
      return err(mapError(error))
    }
    return err(error as E)
  }
}

/**
 * Try to execute async function and catch errors
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  mapError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn()
    return ok(value)
  } catch (error) {
    if (mapError != null) {
      return err(mapError(error))
    }
    return err(error as E)
  }
}

/**
 * Combine multiple Results into single Result of array
 */
export function combine<T, E>(results: Array<Result<T, E>>): Result<T[], E> {
  const values: T[] = []
  
  for (const result of results) {
    if (isErr(result)) {
      return result
    }
    values.push(result.value)
  }
  
  return ok(values)
}

/**
 * Combine multiple Results, collecting all errors
 */
export function combineAll<T, E>(
  results: Array<Result<T, E>>
): Result<T[], E[]> {
  const values: T[] = []
  const errors: E[] = []
  
  for (const result of results) {
    if (isOk(result)) {
      values.push(result.value)
    } else {
      errors.push(result.error)
    }
  }
  
  if (errors.length > 0) {
    return err(errors)
  }
  
  return ok(values)
}