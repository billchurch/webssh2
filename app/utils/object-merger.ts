// app/utils/object-merger.ts
// Pure functions for deep object merging

/**
 * Check if value is a plain object
 * Pure function - no side effects
 * 
 * @param value - Value to check
 * @returns True if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && 
         value !== undefined && 
         typeof value === 'object' && 
         !Array.isArray(value)
}

/**
 * Deep merge two objects
 * Pure function - returns new object without mutating inputs
 * 
 * @param target - Target object
 * @param source - Source object to merge
 * @returns New merged object
 */
export function deepMergePure<T extends object>(target: T, source: unknown): T {
  const output: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  
  if (!isPlainObject(source)) {
    return output as T
  }
  
  for (const key of Object.keys(source)) {
    // Keys come from source object, not user input - safe for property access
    // eslint-disable-next-line security/detect-object-injection
    const sourceValue = source[key]
    // eslint-disable-next-line security/detect-object-injection
    const targetValue = output[key]
    
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      // eslint-disable-next-line security/detect-object-injection
      output[key] = deepMergePure(targetValue, sourceValue)
    } else {
      // eslint-disable-next-line security/detect-object-injection
      output[key] = sourceValue
    }
  }
  
  return output as T
}