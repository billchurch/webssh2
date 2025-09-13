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
      ([k, v]) =>
        typeof k === 'string' &&
        isValidEnvKey(k) &&
        k.length <= ENV_LIMITS.MAX_KEY_LENGTH &&
        (allow != null ? allow.has(k) : true) &&
        v != null &&
        isValidEnvValue(String(v)) &&
        String(v).length <= ENV_LIMITS.MAX_VALUE_LENGTH
    )
    .slice(0, ENV_LIMITS.MAX_PAIRS)
    .map(([k, v]) => [k, String(v)])
  
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