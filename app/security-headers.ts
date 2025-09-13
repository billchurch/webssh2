import type { RequestHandler } from 'express'
import createDebug from 'debug'
import type { Config } from './types/config.js'
import { DEFAULTS, HEADERS } from './constants.js'

const debug = createDebug('webssh2:security')

export const CSP_CONFIG: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'ws:', 'wss:'],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'", 'https:'],
  'upgrade-insecure-requests': [],
}

export function generateCSPHeader(): string {
  return Object.entries(CSP_CONFIG)
    .map(([directive, values]) => (values.length > 0 ? `${directive} ${values.join(' ')}` : directive))
    .join('; ')
}

export const SECURITY_HEADERS: Record<string, string> = {
  [HEADERS.CONTENT_SECURITY_POLICY]: generateCSPHeader(),
  [HEADERS.X_CONTENT_TYPE_OPTIONS]: 'nosniff',
  [HEADERS.X_FRAME_OPTIONS]: 'DENY',
  [HEADERS.X_XSS_PROTECTION]: '1; mode=block',
  [HEADERS.REFERRER_POLICY]: 'strict-origin-when-cross-origin',
  [HEADERS.PERMISSIONS_POLICY]: 'geolocation=(), microphone=(), camera=()',
  [HEADERS.STRICT_TRANSPORT_SECURITY]: `max-age=${DEFAULTS.HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
}

function generateCSPHeaderFromConfig(csp: Record<string, string[]>): string {
  return Object.entries(csp)
    .map(([directive, values]) => (values.length > 0 ? `${directive} ${values.join(' ')}` : directive))
    .join('; ')
}

export function createSecurityHeadersMiddleware(config: Partial<Config> = {}): RequestHandler {
  return (req, res, next) => {
    const headers = { ...SECURITY_HEADERS }

    const trusted = config.sso?.trustedProxies
    if (config.sso?.enabled === true && Array.isArray(trusted) && trusted.length > 0) {
      const cspConfig: Record<string, string[]> = { ...CSP_CONFIG }
      const fa = cspConfig['form-action'] as string[]
      if (!fa.includes('https:')) {
        fa.push('https:')
      }
      headers[HEADERS.CONTENT_SECURITY_POLICY] = generateCSPHeaderFromConfig(cspConfig)
      debug('SSO mode: Adjusted CSP for trusted proxies')
    }

    for (const [header, value] of Object.entries(headers)) {
      if (header === HEADERS.STRICT_TRANSPORT_SECURITY && !req.secure) {
        continue
      }
      res.setHeader(header, value)
    }
    debug('Security headers applied to %s %s', req.method, req.url)
    next()
  }
}

export function createCSPMiddleware(
  customCSP: Partial<Record<keyof typeof CSP_CONFIG, string[]>> = {}
): RequestHandler {
  const merged: Record<string, string[]> = {
    ...CSP_CONFIG,
    ...(customCSP as Record<string, string[]>),
  }
  const header = Object.entries(merged)
    .map(([d, v]) => (v.length > 0 ? `${d} ${v.join(' ')}` : d))
    .join('; ')
  return (req, res, next) => {
    res.setHeader(HEADERS.CONTENT_SECURITY_POLICY, header)
    debug('Custom CSP applied to %s %s', req.method, req.url)
    next()
  }
}
