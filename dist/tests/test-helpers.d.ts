/**
 * Global test helper utilities for environment cleanup
 */
/**
 * Clean up all WEBSSH2_ and PORT environment variables
 * Should be called in beforeEach/afterEach hooks across all test files
 */
export declare function cleanupEnvironmentVariables(): void;
/**
 * Store current environment variables for later restoration
 * @returns Map of environment variables to restore
 */
export declare function storeEnvironmentVariables(): Record<string, string | undefined>;
/**
 * Restore environment variables from stored state
 * @param originalEnv - Map of environment variables to restore
 */
export declare function restoreEnvironmentVariables(originalEnv: Record<string, string | undefined>): void;
//# sourceMappingURL=test-helpers.d.ts.map