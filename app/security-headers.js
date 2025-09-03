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
  'form-action': ["'self'"],
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
export function createSecurityHeadersMiddleware() {
  return (req, res, next) => {
    // Apply all security headers
    Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
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
 * Creates a CSP-only middleware for specific routes
 * @param {Object} customCSP - Custom CSP configuration to merge/override
 * @returns {Function} Express middleware function
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
