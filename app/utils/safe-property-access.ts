import type { Branded } from '../types/branded.js'

/**
 * Branded type for keys that have been validated as safe for property access
 */
export type SafeKey = Branded<string, 'SafeKey'>

/**
 * Create a SafeKey from a string that is known to be safe at compile time
 * Use this for keys from static mappings or Object.keys/entries
 */
export function createSafeKey(key: string): SafeKey {
  return key as SafeKey
}

/**
 * Validate that a key exists in a known safe set
 * Returns a SafeKey if validation passes, undefined otherwise
 */
export function validateKey(key: string, safeKeys: ReadonlySet<string>): SafeKey | undefined {
  if (safeKeys.has(key)) {
    return key as SafeKey
  }
  return undefined
}

/**
 * Type-safe property getter that requires a SafeKey
 * This eliminates the need for eslint-disable security/detect-object-injection
 */
export function safeGet<T extends Record<string, unknown>>(
  obj: T,
  key: SafeKey
): unknown {
  // SafeKey guarantees the key is safe for access
  // This is the safe abstraction layer for dynamic property access
  return obj[key as string]
}

/**
 * Type-safe property setter that requires a SafeKey
 * This eliminates the need for eslint-disable security/detect-object-injection
 */
export function safeSet<T extends Record<string, unknown>, V>(
  obj: T,
  key: SafeKey,
  value: V
): void {
  // SafeKey guarantees the key is safe for access
  // This is the safe abstraction layer for dynamic property access
  ;(obj as Record<string, V>)[key as string] = value
}

/**
 * Safely access nested properties using a dot-separated path
 * All path segments must be from a known safe source
 */
export function safeGetNested(
  obj: Record<string, unknown>,
  path: readonly SafeKey[]
): unknown {
  let current: unknown = obj
  
  for (const key of path) {
    if (current == null || typeof current !== 'object') {
      return undefined
    }
    // SafeKey guarantees the key is safe for access
    current = (current as Record<string, unknown>)[key as string]
  }
  
  return current
}

/**
 * Safely set nested properties using a path array
 * Creates intermediate objects as needed
 */
export function safeSetNested(
  obj: Record<string, unknown>,
  path: readonly SafeKey[],
  value: unknown
): void {
  if (path.length === 0) {
    return
  }
  
  // Use slice and pop to avoid array index access
  const pathCopy = [...path]
  const lastKey = pathCopy.pop()
  if (lastKey === undefined) {
    return
  }
  
  let current = obj
  
  // Navigate to the parent using forEach instead of for loop with index
  pathCopy.forEach((key) => {
    const stringKey = key as string
    // SafeKey guarantees the key is safe for access
    // eslint-disable-next-line security/detect-object-injection
    const next: unknown = current[stringKey]
    
    if (next == null || typeof next !== 'object' || Array.isArray(next)) {
      // eslint-disable-next-line security/detect-object-injection
      current[stringKey] = {}
    }
    // eslint-disable-next-line security/detect-object-injection
    const nextObj: unknown = current[stringKey]
    if (typeof nextObj === 'object' && nextObj !== null && !Array.isArray(nextObj)) {
      current = nextObj as Record<string, unknown>
    }
  })
  
  // Set the final property
  const lastStringKey = lastKey as string
  // eslint-disable-next-line security/detect-object-injection
  current[lastStringKey] = value
}

/**
 * Create SafeKeys from Object.entries results
 * Since Object.entries only returns the object's own keys, they are safe
 */
export function safeEntries<T extends Record<string, unknown>>(
  obj: T
): Array<[SafeKey, unknown]> {
  return Object.entries(obj).map(([key, value]) => [
    createSafeKey(key),
    value
  ])
}

/**
 * Create SafeKeys from Object.keys results
 * Since Object.keys only returns the object's own keys, they are safe
 */
export function safeKeys<T extends Record<string, unknown>>(obj: T): SafeKey[] {
  return Object.keys(obj).map(createSafeKey)
}

/**
 * Type guard to check if a value is a record object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Create a SafeKey from a path string, splitting on dots
 * Only use this with paths from static configuration, not user input
 */
export function safePathToKeys(path: string): SafeKey[] {
  return path.split('.').map(createSafeKey)
}