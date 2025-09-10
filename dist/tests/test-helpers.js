// server
// tests/test-helpers.ts
/**
 * Global test helper utilities for environment cleanup
 */
/**
 * Clean up all WEBSSH2_ and PORT environment variables
 * Should be called in beforeEach/afterEach hooks across all test files
 */
export function cleanupEnvironmentVariables() {
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('WEBSSH2_') || key === 'PORT') {
      delete process.env[key]
    }
  })
}
/**
 * Global cleanup function for test file module imports
 */
function cleanupEnvironmentVariablesGlobal() {
  cleanupEnvironmentVariables()
}
// Global cleanup - runs when module is imported
cleanupEnvironmentVariablesGlobal()
/**
 * Store current environment variables for later restoration
 * @returns Map of environment variables to restore
 */
export function storeEnvironmentVariables() {
  const originalEnv = {}
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('WEBSSH2_') || key === 'PORT') {
      originalEnv[key] = process.env[key]
    }
  })
  return originalEnv
}
/**
 * Restore environment variables from stored state
 * @param originalEnv - Map of environment variables to restore
 */
export function restoreEnvironmentVariables(originalEnv) {
  // First clean up current env vars
  cleanupEnvironmentVariables()
  // Then restore original values
  Object.keys(originalEnv).forEach((key) => {
    if (originalEnv[key] !== undefined) {
      process.env[key] = originalEnv[key]
    }
  })
}
//# sourceMappingURL=test-helpers.js.map
