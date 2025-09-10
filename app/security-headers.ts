/**
 * Security Headers Configuration for WebSSH2
 * Content Security Policy and other security headers
 */

import type { Request, Response, NextFunction } from 'express';
import createDebug from 'debug';

const debug = createDebug('webssh2:security');

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
export const CSP_CONFIG: CSPDirective = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"], // unsafe-inline needed for xterm.js
  'style-src': ["'self'", "'unsafe-inline'"], // unsafe-inline needed for terminal styling
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'ws:', 'wss:'], // WebSocket connections
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'", 'https:'], // Allow HTTPS form submissions for SSO
  'upgrade-insecure-requests': [],
};

/**
 * Generates CSP header string from config
 * @returns The complete CSP header value
 */
export function generateCSPHeader(): string {
  return Object.entries(CSP_CONFIG)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Security headers configuration
 * Additional security headers to prevent various attacks
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': generateCSPHeader(),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', // HSTS for HTTPS
};

/**
 * Creates security headers middleware
 * @param config - Application configuration (optional)
 * @returns Express middleware function
 */
export function createSecurityHeadersMiddleware(config: SecurityConfig = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Create a copy of security headers to modify if needed
    const headers = { ...SECURITY_HEADERS };

    // If SSO is enabled and trusted proxies are configured, adjust CSP
    if (config.sso?.enabled && config.sso?.trustedProxies?.length && config.sso.trustedProxies.length > 0) {
      const cspConfig = { ...CSP_CONFIG };
      // Add trusted proxy domains to form-action if needed
      // This allows forms to be submitted from APM portals
      const formAction = cspConfig['form-action'];
      if (formAction && !formAction.includes('https:')) {
        formAction.push('https:');
      }
      headers['Content-Security-Policy'] = generateCSPHeaderFromConfig(cspConfig);
      debug('SSO mode: Adjusted CSP for trusted proxies');
    }

    // Apply all security headers
    Object.entries(headers).forEach(([header, value]) => {
      // Skip HSTS header for non-HTTPS requests
      if (header === 'Strict-Transport-Security' && !req.secure) {
        return;
      }
      res.setHeader(header, value);
    });

    debug('Security headers applied to %s %s', req.method, req.url);
    next();
  };
}

/**
 * Helper function to generate CSP header from config object
 * @param cspConfig - CSP configuration object
 * @returns The complete CSP header value
 */
function generateCSPHeaderFromConfig(cspConfig: CSPDirective): string {
  return Object.entries(cspConfig)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Creates a CSP-only middleware for specific routes
 * @param customCSP - Custom CSP configuration to merge/override
 * @returns Express middleware function
 */
export function createCSPMiddleware(customCSP: CSPDirective = {}) {
  const mergedCSP = { ...CSP_CONFIG, ...customCSP };

  const customCSPHeader = Object.entries(mergedCSP)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');

  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Content-Security-Policy', customCSPHeader);
    debug('Custom CSP applied to %s %s', req.method, req.url);
    next();
  };
}

export default {
  CSP_CONFIG,
  generateCSPHeader,
  SECURITY_HEADERS,
  createSecurityHeadersMiddleware,
  createCSPMiddleware,
};

export type { CSPDirective, SecurityConfig };