// app/validation/environment.ts
// Pure validation functions for environment variables

import { ENV_LIMITS } from '../constants.js'

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
  return !/[;&|`$]/.test(value)
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
      // eslint-disable-next-line security/detect-object-injection
      envVars[key] = value
      added++
    }
  }

  return Object.keys(envVars).length > 0 ? envVars : null
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
  const result: Record<string, string> = {}

  if (envVars == null || typeof envVars !== 'object') {
    return result
  }

  const allowSet = allowlist != null ? new Set(allowlist) : null
  let count = 0

  for (const [key, value] of Object.entries(envVars)) {
    // Skip if we've hit the limit
    if (count >= ENV_LIMITS.MAX_PAIRS) {
      break
    }

    // Validate key
    if (typeof key !== 'string' || !isValidEnvKey(key) || key.length > ENV_LIMITS.MAX_KEY_LENGTH) {
      continue
    }

    // Check allowlist if provided
    if (allowSet != null && !allowSet.has(key)) {
      continue
    }

    // Validate value
    if (value == null) {
      continue
    }

    // Only allow string, number, or boolean values
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue
    }
    const stringValue = String(value)
    if (!isValidEnvValue(stringValue) || stringValue.length > ENV_LIMITS.MAX_VALUE_LENGTH) {
      continue
    }

    // Key is validated above via isValidEnvKey
    // eslint-disable-next-line security/detect-object-injection
    result[key] = stringValue
    count++
  }

  return result
}
