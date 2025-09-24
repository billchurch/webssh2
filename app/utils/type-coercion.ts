/**
 * Type-safe coercion utilities to eliminate @typescript-eslint/no-base-to-string warnings
 * These functions provide proper type guards and safe string conversion
 */

/**
 * Safely convert a value to string with proper type checking
 * Handles null, undefined, objects, and arrays correctly
 */
export function safeToString(value: unknown): string | undefined {
  if (value == null) {
    return undefined
  }
  
  // Check for objects that shouldn't be stringified
  if (typeof value === 'object') {
    // Arrays can be reasonably converted to string
    if (Array.isArray(value)) {
      return value.join(',')
    }
    // For plain objects, return undefined rather than "[object Object]"
    return undefined
  }
  
  // At this point, value is a primitive type (string, number, boolean, bigint, symbol)
  // Explicitly handle each primitive type
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (typeof value === 'symbol') {
    return value.toString()
  }
  
  // TypeScript should ensure this is never reached, but for safety
  return undefined
}

/**
 * Safely convert a value to string for validation purposes
 * Returns empty string for null/undefined/objects
 */
export function coerceToStringForValidation(value: unknown): string {
  const result = safeToString(value)
  return result ?? ''
}

/**
 * Type guard to check if a value can be meaningfully converted to string
 */
export function isStringifiable(value: unknown): value is string | number | boolean | bigint {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
}

/**
 * Convert value to number if possible, return undefined otherwise
 */
export function safeToNumber(value: unknown): number | undefined {
  if (value == null) {
    return undefined
  }
  
  if (typeof value === 'number') {
    return value
  }
  
  if (typeof value === 'string') {
    const num = Number(value)
    return isNaN(num) ? undefined : num
  }
  
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  
  return undefined
}

/**
 * Safe integer parsing with validation
 */
export function safeParseInt(value: unknown, radix = 10): number | undefined {
  const str = safeToString(value)
  if (str === undefined) {
    return undefined
  }
  
  const result = Number.parseInt(str, radix)
  return Number.isNaN(result) ? undefined : result
}

/**
 * Type guard for checking if value is not null or undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value != null
}

/**
 * Type guard for non-object primitive types
 */
export function isPrimitive(value: unknown): value is string | number | boolean | bigint | symbol | null | undefined {
  return value == null || typeof value !== 'object'
}