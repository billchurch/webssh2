// app/connection/environment-filter.ts
// Pure functions for filtering environment variables

import { isValidEnvKey, isValidEnvValue } from '../validation/environment.js'
import { ENV_LIMITS } from '../constants.js'

/**
 * Filter and validate environment variables for SSH connection
 * @param envVars - Raw environment variables
 * @param allowlist - Optional allowlist of permitted variables
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
  
  const allow = allowlist != null && Array.isArray(allowlist) 
    ? new Set(allowlist) 
    : null
  
  // Transform safely: entries → filter → map → fromEntries
  const entries = Object.entries(envVars)
    .filter(
      ([k, v]) => {
        if (typeof k !== 'string' || !isValidEnvKey(k) || k.length > ENV_LIMITS.MAX_KEY_LENGTH) {
          return false
        }
        if (allow != null && !allow.has(k)) {
          return false
        }
        if (v == null) {
          return false
        }
        // Only process string, number, or boolean values
        const valueType = typeof v
        if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean') {
          return false
        }
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const strValue = String(v)
        return isValidEnvValue(strValue) && strValue.length <= ENV_LIMITS.MAX_VALUE_LENGTH
      }
    )
    .slice(0, ENV_LIMITS.MAX_PAIRS)
    .map(([k, v]) => {
      // At this point, v is guaranteed to be string, number, or boolean by the filter above
      // TypeScript doesn't narrow the type through the filter, so we cast
      return [k, String(v as string | number | boolean)]
    })
  
  return Object.fromEntries(entries) as Record<string, string>
}

/**
 * Check if environment variable should be allowed
 * @param key - Variable name
 * @param allowlist - Optional allowlist
 * @returns true if variable should be allowed
 * @pure
 */
export function isAllowedEnvVar(
  key: string,
  allowlist?: string[] | null
): boolean {
  if (!isValidEnvKey(key)) {
    return false
  }
  
  if (key.length > ENV_LIMITS.MAX_KEY_LENGTH) {
    return false
  }
  
  if (allowlist != null && Array.isArray(allowlist)) {
    return allowlist.includes(key)
  }
  
  return true
}