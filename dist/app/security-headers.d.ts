/**
 * Security Headers Configuration for WebSSH2
 * Content Security Policy and other security headers
 */
import type { Request, Response, NextFunction } from 'express';
/**
 * Content Security Policy configuration type
 */
type CSPDirective = Record<string, string[]>;
/**
 * Configuration interface for security headers middleware
 */
interface SecurityConfig {
    sso?: {
        enabled?: boolean;
        trustedProxies?: string[];
    };
}
/**
 * Content Security Policy Configuration
 * Helps prevent XSS attacks by restricting resource loading
 *
 * Note: 'unsafe-inline' is required for:
 * - xterm.js terminal rendering
 * - Dynamic terminal styling
 */
export declare const CSP_CONFIG: CSPDirective;
/**
 * Generates CSP header string from config
 * @returns The complete CSP header value
 */
export declare function generateCSPHeader(): string;
/**
 * Security headers configuration
 * Additional security headers to prevent various attacks
 */
export declare const SECURITY_HEADERS: Record<string, string>;
/**
 * Creates security headers middleware
 * @param config - Application configuration (optional)
 * @returns Express middleware function
 */
export declare function createSecurityHeadersMiddleware(config?: SecurityConfig): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Creates a CSP-only middleware for specific routes
 * @param customCSP - Custom CSP configuration to merge/override
 * @returns Express middleware function
 */
export declare function createCSPMiddleware(customCSP?: CSPDirective): (req: Request, res: Response, next: NextFunction) => void;
declare const _default: {
    CSP_CONFIG: CSPDirective;
    generateCSPHeader: typeof generateCSPHeader;
    SECURITY_HEADERS: Record<string, string>;
    createSecurityHeadersMiddleware: typeof createSecurityHeadersMiddleware;
    createCSPMiddleware: typeof createCSPMiddleware;
};
export default _default;
export type { CSPDirective, SecurityConfig };
//# sourceMappingURL=security-headers.d.ts.map