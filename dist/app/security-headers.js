/**
 * Security Headers Configuration for WebSSH2
 * Content Security Policy and other security headers
 */

import createDebug from 'debug'

const debug = createDebug('webssh2:security')

/**
 * Content Security Policy Configuration
 * Helps prevent XSS attacks by restricting resource loading
 *
 * Note: 'unsafe-inline' is required for:
 * - xterm.js terminal rendering
 * - Dynamic terminal styling
 */
/** @type {Record<string, string[]>} */
export const CSP_CONFIG = {
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
}

/**
 * Generates CSP header string from config
 * @returns {string} The complete CSP header value
 */
export function generateCSPHeader() {
  return Object.entries(CSP_CONFIG)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive
      }
      return `${directive} ${values.join(' ')}`
    })
    .join('; ')
}

/**
 * Security headers configuration
 * Additional security headers to prevent various attacks
 */
/** @type {Record<string, string>} */
export const SECURITY_HEADERS = {
  'Content-Security-Policy': generateCSPHeader(),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', // HSTS for HTTPS
}

/**
 * Creates security headers middleware
 * @param {Object} config - Application configuration (optional)
 * @returns {Function} Express middleware function
 */
/**
 * @param {Partial<import('./types/config.js').Config>} [config]
 * @returns {import('express').RequestHandler}
 */
export function createSecurityHeadersMiddleware(config = {}) {
  return (req, res, next) => {
    // Create a copy of security headers to modify if needed
    const headers = { ...SECURITY_HEADERS }

    // If SSO is enabled and trusted proxies are configured, adjust CSP
    if (config.sso?.enabled && config.sso?.trustedProxies?.length > 0) {
      /** @type {Record<string, string[]>} */
      const cspConfig = { ...CSP_CONFIG }
      // Add trusted proxy domains to form-action if needed
      // This allows forms to be submitted from APM portals
      if (!cspConfig['form-action'].includes('https:')) {
        cspConfig['form-action'].push('https:')
      }
      headers['Content-Security-Policy'] = generateCSPHeaderFromConfig(cspConfig)
      debug('SSO mode: Adjusted CSP for trusted proxies')
    }

    // Apply all security headers
    Object.entries(headers).forEach(([header, value]) => {
      // Skip HSTS header for non-HTTPS requests
      if (header === 'Strict-Transport-Security' && !req.secure) {
        return
      }
      res.setHeader(header, value)
    })

    debug('Security headers applied to %s %s', req.method, req.url)
    next()
  }
}

/**
 * Helper function to generate CSP header from config object
 * @param {Object} cspConfig - CSP configuration object
 * @returns {string} The complete CSP header value
 */
/**
 * @param {Record<string, string[]>} cspConfig
 */
function generateCSPHeaderFromConfig(cspConfig) {
  return Object.entries(cspConfig)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive
      }
      return `${directive} ${values.join(' ')}`
    })
    .join('; ')
}

/**
 * Creates a CSP-only middleware for specific routes
 * @param {Object} customCSP - Custom CSP configuration to merge/override
 * @returns {Function} Express middleware function
 */
/**
 * @param {Partial<Record<keyof typeof CSP_CONFIG, string[]>>} [customCSP]
 * @returns {import('express').RequestHandler}
 */
export function createCSPMiddleware(customCSP = {}) {
  const mergedCSP = { ...CSP_CONFIG, ...customCSP }

  const customCSPHeader = Object.entries(mergedCSP)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive
      }
      return `${directive} ${values.join(' ')}`
    })
    .join('; ')

  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', customCSPHeader)
    debug('Custom CSP applied to %s %s', req.method, req.url)
    next()
  }
}

export default {
  CSP_CONFIG,
  generateCSPHeader,
  SECURITY_HEADERS,
  createSecurityHeadersMiddleware,
  createCSPMiddleware,
}
