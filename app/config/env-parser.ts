// app/config/env-parser.ts
// Pure functions for parsing environment variable values

export type EnvValueType = 'string' | 'number' | 'boolean' | 'array' | 'preset'

/**
 * Parse a comma-separated or JSON array string into array
 * @param value - String value to parse
 * @returns Array of strings
 * @pure
 */
export function parseArrayValue(value: string): string[] {
  if (value === '') {
    return []
  }
  
  // Try to parse as JSON array first
  if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      // Fall through to comma-separated parsing
    }
  }
  
  // Parse as comma-separated values
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * Parse an environment variable value based on its type
 * @param value - String value from environment
 * @param type - Expected type of the value
 * @returns Parsed value of appropriate type
 * @pure
 */
export function parseEnvValue(
  value: string,
  type: EnvValueType
): string | number | boolean | string[] | null {
  if (value === 'null') {
    return null
  }
  
  if (value === '') {
    return type === 'array' ? [] : null
  }
  
  switch (type) {
    case 'boolean':
      return value === 'true' || value === '1'
    case 'number':
      return parseInt(value, 10)
    case 'array':
      return parseArrayValue(value)
    case 'string':
      return value
    case 'preset':
      // Presets are handled upstream; return raw value
      return value
  }
}

/**
 * Parse boolean environment variable with default
 * @param value - String value from environment
 * @param defaultValue - Default boolean value
 * @returns Parsed boolean
 * @pure
 */
export function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue
  }
  return value === 'true' || value === '1'
}

/**
 * Parse number environment variable with default
 * @param value - String value from environment
 * @param defaultValue - Default number value
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Parsed number within bounds
 * @pure
 */
export function parseNumberEnv(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (value === undefined || value === '') {
    return defaultValue
  }
  
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    return defaultValue
  }
  
  let result = parsed
  if (min !== undefined && result < min) {
    result = min
  }
  if (max !== undefined && result > max) {
    result = max
  }
  
  return result
}