import createDebug from 'debug';
/**
 * Creates a debug function for a specific namespace
 * @param namespace - The debug namespace
 * @returns The debug function
 */
export declare function createNamespacedDebug(namespace: string): createDebug.Debugger;
/**
 * Logs an error message
 * @param message - The error message
 * @param error - The error object
 */
export declare function logError(message: string, error?: Error | unknown): void;
//# sourceMappingURL=logger.d.ts.map