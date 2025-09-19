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
  
  // Convert to Map for safe property access
  const sourceMap = new Map(Object.entries(source))
  const outputMap = new Map(Object.entries(output))
  
  for (const [key, sourceValue] of sourceMap) {
    const targetValue = outputMap.get(key)
    
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      outputMap.set(key, deepMergePure(targetValue, sourceValue))
    } else {
      outputMap.set(key, sourceValue)
    }
  }
  
  // Convert Map back to object
  return Object.fromEntries(outputMap) as T
}