// app/validation/environment.ts
// Pure validation functions for environment variables

import { ENV_LIMITS } from '../constants/index.js'

/**
 * Validates environment variable key format
 * @param key - Environment variable key
 * @returns true if valid key format
 * @pure
 */
export function isValidEnvKey(key: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(key)
}

/**
 * Validates environment variable value for safety
 * @param value - Environment variable value
 * @returns true if value is safe
 * @pure
 */
export function isValidEnvValue(value: string): boolean {
  return value !== '' && !/[;&|`$]/.test(value)
}

/**
 * Parses environment variable string into key-value pairs
 * @param envString - Comma-separated key:value pairs
 * @returns Parsed environment variables or null
 * @pure
 */
export function parseEnvVars(envString?: string): Record<string, string> | null {
  if (envString == null || envString === '') {
    return null
  }

  const envVars: Record<string, string> = {}
  const pairs = envString.split(',')
  let added = 0

  for (const pairString of pairs) {
    const pair = pairString.split(':')
    if (pair.length !== 2) {
      continue
    }

    const [keyRaw, valueRaw] = pair as [string, string]
    const key = keyRaw.trim()
    const value = valueRaw.trim()

    if (
      isValidEnvKey(key) &&
      isValidEnvValue(value) &&
      key.length <= ENV_LIMITS.MAX_KEY_LENGTH &&
      value.length <= ENV_LIMITS.MAX_VALUE_LENGTH &&
      added < ENV_LIMITS.MAX_PAIRS
    ) {
      // Key is validated above to be a safe environment variable name
      // Using Object.defineProperty for safe property assignment
      Object.defineProperty(envVars, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      })
      added++
    }
  }

  return Object.keys(envVars).length > 0 ? envVars : null
}

/**
 * Check if a key is valid for environment variables
 * @param key - Key to validate
 * @param allowSet - Optional allowlist set
 * @returns true if key passes all validations
 * @pure
 */
function isKeyValid(
  key: unknown,
  allowSet: Set<string> | null
): key is string {
  if (typeof key !== 'string') {
    return false
  }
  if (!isValidEnvKey(key)) {
    return false
  }
  if (key.length > ENV_LIMITS.MAX_KEY_LENGTH) {
    return false
  }
  if (allowSet != null && !allowSet.has(key)) {
    return false
  }
  return true
}

/**
 * Convert and validate a value for environment variables
 * @param value - Value to validate
 * @returns Validated string value or null if invalid
 * @pure
 */
function validateEnvValue(value: unknown): string | null {
  if (value == null) {
    return null
  }
  
  // Only allow string, number, or boolean values
  if (typeof value === 'string') {
    const stringValue = value
    if (!isValidEnvValue(stringValue) || stringValue.length > ENV_LIMITS.MAX_VALUE_LENGTH) {
      return null
    }
    return stringValue
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    const stringValue = String(value)
    if (!isValidEnvValue(stringValue) || stringValue.length > ENV_LIMITS.MAX_VALUE_LENGTH) {
      return null
    }
    return stringValue
  }
  
  return null
}

/**
 * Process a single environment variable entry
 * @param key - Environment variable key
 * @param value - Environment variable value
 * @param allowSet - Optional allowlist set
 * @returns Validated key-value pair or null if invalid
 * @pure
 */
function processEnvEntry(
  key: unknown,
  value: unknown,
  allowSet: Set<string> | null
): { key: string; value: string } | null {
  if (!isKeyValid(key, allowSet)) {
    return null
  }
  
  const validatedValue = validateEnvValue(value)
  if (validatedValue == null) {
    return null
  }
  
  return { key, value: validatedValue }
}

/**
 * Filters environment variables based on allowlist and safety rules
 * @param envVars - Raw environment variables
 * @param allowlist - Optional list of allowed keys
 * @returns Filtered and validated environment variables
 * @pure
 */
export function filterEnvironmentVariables(
  envVars: Record<string, unknown> | undefined,
  allowlist?: string[] | null
): Record<string, string> {
  if (envVars == null || typeof envVars !== 'object') {
    return {}
  }

  const allowSet = allowlist == null ? null : new Set(allowlist)
  const result: Record<string, string> = {}
  let count = 0

  for (const [key, value] of Object.entries(envVars)) {
    if (count >= ENV_LIMITS.MAX_PAIRS) {
      break
    }

    const processed = processEnvEntry(key, value, allowSet)
    if (processed != null) {
      // Key is validated above via isKeyValid -> isValidEnvKey
      // Using Object.defineProperty for safe property assignment
      Object.defineProperty(result, processed.key, {
        value: processed.value,
        writable: true,
        enumerable: true,
        configurable: true
      })
      count++
    }
  }

  return result
}
