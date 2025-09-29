// app/utils/result.ts
// Production utility functions for working with Result types

import type { Result, Ok, Err } from '../types/result.js'

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
 * Check if result is error
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false
}