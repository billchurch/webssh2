import { type Config } from './configSchema.js';
/**
 * Credentials interface for SSH connections
 */
export interface Credentials {
    username: string;
    host: string;
    port: number;
    password?: string;
    privateKey?: string;
    passphrase?: string;
}
/**
 * Masking options for sensitive data
 */
export interface MaskOptions {
    properties?: string[];
    maskLength?: number;
    minLength?: number;
    maxLength?: number;
    maskChar?: string;
    fullMask?: boolean;
}
/**
 * Deep merges two objects
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns The merged object
 */
export declare function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown>;
/**
 * Determines if a given host is an IP address or a hostname.
 * If it's a hostname, it escapes it for safety.
 *
 * @param host - The host string to validate and escape.
 * @returns - The original IP or escaped hostname.
 */
export declare function getValidatedHost(host: string): string;
/**
 * Validates and sanitizes a port value.
 * If no port is provided, defaults to port 22.
 * If a port is provided, checks if it is a valid port number (1-65535).
 * If the port is invalid, defaults to port 22.
 *
 * @param portInput - The port string to validate and parse.
 * @returns - The validated port number.
 */
export declare function getValidatedPort(portInput?: string): number;
/**
 * Checks if the provided credentials object is valid.
 * Valid credentials must have:
 * - username (string)
 * - host (string)
 * - port (number)
 * AND either:
 * - password (string) OR
 * - privateKey (string) with optional passphrase (string)
 *
 * @param creds - The credentials object.
 * @returns - Returns true if the credentials are valid, otherwise false.
 */
export declare function isValidCredentials(creds: unknown): creds is Credentials;
/**
 * Validates and sanitizes the SSH terminal name using validator functions.
 * Allows alphanumeric characters, hyphens, and periods.
 * Returns null if the terminal name is invalid or not provided.
 *
 * @param term - The terminal name to validate.
 * @returns - The sanitized terminal name if valid, null otherwise.
 */
export declare function validateSshTerm(term?: string): string | null;
/**
 * Validates the given configuration object.
 *
 * @param config - The configuration object to validate.
 * @throws If the configuration object fails validation.
 * @returns The validated configuration object.
 */
export declare function validateConfig(config: unknown): Config;
/**
 * Modify the HTML content by replacing certain placeholders with dynamic values.
 * @param html - The original HTML content.
 * @param config - The configuration object to inject into the HTML.
 * @returns - The modified HTML content.
 */
export declare function modifyHtml(html: string, config: Record<string, unknown>): string;
/**
 * Masks sensitive information in an object
 * @param obj - The object to mask
 * @param options - Optional configuration for masking
 * @returns The masked object
 */
export declare function maskSensitiveData(obj: Record<string, unknown>, options?: MaskOptions): Record<string, unknown>;
/**
 * Validates and sanitizes environment variable key names
 * @param key - The environment variable key to validate
 * @returns - Whether the key is valid
 */
export declare function isValidEnvKey(key: string): boolean;
/**
 * Validates and sanitizes environment variable values
 * @param value - The environment variable value to validate
 * @returns - Whether the value is valid
 */
export declare function isValidEnvValue(value: string): boolean;
/**
 * Parses and validates environment variables from URL query string
 * @param envString - The environment string from URL query
 * @returns - Object containing validated env vars or null if invalid
 */
export declare function parseEnvVars(envString: string): Record<string, string> | null;
//# sourceMappingURL=utils.d.ts.map