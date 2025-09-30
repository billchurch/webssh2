// app/socket/handlers/exec-environment.ts
// Environment variable handling utilities

/**
 * Merges environment variables from multiple sources
 * @param sources - Array of environment variable objects
 * @returns Merged environment variables
 * @pure
 */
export function mergeEnvironmentVariables(
  ...sources: Array<Record<string, string> | undefined | null>
): Record<string, string> {
  const merged: Record<string, string> = {}

  for (const source of sources) {
    if (source != null && typeof source === 'object') {
      Object.assign(merged, source)
    }
  }

  return merged
}