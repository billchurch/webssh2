import type { Response } from 'express';
/**
 * Custom error for WebSSH2
 */
export declare class WebSSH2Error extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
/**
 * Custom error for configuration issues
 */
export declare class ConfigError extends WebSSH2Error {
    constructor(message: string);
}
/**
 * Custom error for SSH connection issues
 */
export declare class SSHConnectionError extends WebSSH2Error {
    constructor(message: string);
}
/**
 * Handles an error by logging it and optionally sending a response
 * @param err - The error to handle
 * @param res - The response object (if in an Express route)
 */
export declare function handleError(err: Error | unknown, res?: Response): void;
//# sourceMappingURL=errors.d.ts.map