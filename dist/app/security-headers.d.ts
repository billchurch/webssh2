/**
 * Generates CSP header string from config
 * @returns {string} The complete CSP header value
 */
export function generateCSPHeader(): string;
/**
 * Creates security headers middleware
 * @param {Object} config - Application configuration (optional)
 * @returns {Function} Express middleware function
 */
export function createSecurityHeadersMiddleware(config?: Object): Function;
/**
 * Creates a CSP-only middleware for specific routes
 * @param {Object} customCSP - Custom CSP configuration to merge/override
 * @returns {Function} Express middleware function
 */
export function createCSPMiddleware(customCSP?: Object): Function;
/**
 * Content Security Policy Configuration
 * Helps prevent XSS attacks by restricting resource loading
 *
 * Note: 'unsafe-inline' is required for:
 * - xterm.js terminal rendering
 * - Dynamic terminal styling
 */
export const CSP_CONFIG: {
    'default-src': string[];
    'script-src': string[];
    'style-src': string[];
    'img-src': string[];
    'font-src': string[];
    'connect-src': string[];
    'frame-src': string[];
    'object-src': string[];
    'base-uri': string[];
    'form-action': string[];
    'upgrade-insecure-requests': never[];
};
/**
 * Security headers configuration
 * Additional security headers to prevent various attacks
 */
export const SECURITY_HEADERS: {
    'Content-Security-Policy': string;
    'X-Content-Type-Options': string;
    'X-Frame-Options': string;
    'X-XSS-Protection': string;
    'Referrer-Policy': string;
    'Permissions-Policy': string;
    'Strict-Transport-Security': string;
};
declare namespace _default {
    export { CSP_CONFIG };
    export { generateCSPHeader };
    export { SECURITY_HEADERS };
    export { createSecurityHeadersMiddleware };
    export { createCSPMiddleware };
}
export default _default;
