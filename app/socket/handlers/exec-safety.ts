// app/socket/handlers/exec-safety.ts
// Command safety validation functions

import { VALIDATION_LIMITS } from '../../constants/index.js'

/**
 * Validates command string for safety
 * @param command - Command to validate
 * @returns True if command appears safe
 * @pure
 */
export function isCommandSafe(command: string): boolean {
  // Basic safety checks - can be expanded based on requirements
  const dangerousPatterns = [
    /;\s*rm\s+-rf\s+\//i,     // rm -rf /
    /dd\s+.*of=\/dev\//i,     // NOSONAR dd overwriting devices
    />\s*\/dev\/s[a-z]+/i,    // Redirecting to block devices
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return false
    }
  }

  return true
}

/**
 * Sanitizes environment variable name
 * @param name - Variable name
 * @returns Sanitized name or null if invalid
 * @pure
 */
export function sanitizeEnvVarName(name: string): string | null {
  // Allow alphanumeric and underscore characters
  const sanitized = name.replaceAll(/\W/g, '')

  if (sanitized === '' || sanitized.length > VALIDATION_LIMITS.MAX_ENV_VAR_NAME_LENGTH) {
    return null
  }

  // Don't allow names starting with numbers
  if (/^\d/.test(sanitized)) {
    return null
  }

  return sanitized
}

/**
 * Filters environment variables for safety
 * @param env - Environment variables
 * @returns Filtered environment variables
 * @pure
 */
export function filterEnvironmentVariables(
  env: Record<string, string>
): Record<string, string> {
  const filtered: Record<string, string> = {}

  // List of sensitive variables to exclude
  const sensitiveVars = new Set([
    'SSH_AUTH_SOCK',
    'SSH_AGENT_PID',
    'GPG_AGENT_INFO',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
  ])

  const envEntries = Object.entries(env)
  for (const [key, value] of envEntries) {
    const sanitizedKey = sanitizeEnvVarName(key)

    if (sanitizedKey != null && !sensitiveVars.has(sanitizedKey)) {
      // Limit value length and use Object.defineProperty to avoid object injection warning
      Object.defineProperty(filtered, sanitizedKey, {
        value: value.substring(0, VALIDATION_LIMITS.MAX_ENV_VALUE_LENGTH),
        writable: true,
        enumerable: true,
        configurable: true
      })
    }
  }

  return filtered
}