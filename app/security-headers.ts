// app/security-headers.ts
// Tightened, config-driven, memoized CSP builder and security-headers middleware.

import type { RequestHandler } from 'express'
import createDebug from 'debug'
import type { Config, CspMode } from './types/config.js'
import { DEFAULTS, HEADERS } from './constants/index.js'
import { deriveConnectSrc } from './security/connect-src.js'

const debug = createDebug('webssh2:security')

// xterm.js injects inline style attributes at runtime; unsafe-inline is
// unavoidable for style-src until a nonce/hash approach is added.
const STYLE_SRC = ["'self'", "'unsafe-inline'"] as const

// ---------------------------------------------------------------------------
// Pure CSP building helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a frame-ancestors token: bare 'none' and 'self' get quoted;
 * fully-qualified URLs are passed through verbatim.
 */
function normalizeAncestor(value: string): string {
  return value === 'none' || value === 'self' ? `'${value}'` : value
}

/**
 * Build the ordered CSP directive map from config + TLS context.
 * Pure function — safe to call once and cache.
 */
export function buildCspDirectives(
  config: Pick<Config, 'http' | 'csp'>,
  secure: boolean
): Record<string, string[]> {
  const csp = config.csp
  const connect = deriveConnectSrc(config.http.origins, csp.connectSrc, secure)

  // Fail safe: an empty frame-ancestors list would serialize to a bare
  // directive name that browsers reject, silently disabling framing
  // protection. Fall back to the most restrictive value instead.
  const frameAncestors = csp.frameAncestors.length > 0 ? csp.frameAncestors : ['none']

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': [...STYLE_SRC],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'"],
    'connect-src': connect.sources,
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'frame-ancestors': frameAncestors.map(normalizeAncestor),
    'form-action': ["'self'"],
  }

  if (csp.mode !== 'off') {
    directives['report-uri'] = [csp.reportUri]
    directives['report-to'] = ['csp-endpoint']
  }

  return directives
}

/**
 * Serialize a directive map to a header value string.
 * Directives appear in insertion order, values joined with spaces.
 */
export function cspHeaderValue(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([d, v]) => (v.length > 0 ? `${d} ${v.join(' ')}` : d))
    .join('; ')
}

// ---------------------------------------------------------------------------
// Static-header derivation helpers
// ---------------------------------------------------------------------------

/** Determine X-Frame-Options from frame-ancestors config (may return null). */
function resolveFrameOptions(frameAncestors: string[]): string | null {
  // Fail safe: an empty list means buildCspDirectives falls back to 'none', so
  // mirror that here and deny framing outright.
  if (frameAncestors.length === 0) {
    return 'DENY'
  }
  if (frameAncestors.length === 1 && frameAncestors[0] === 'none') {
    return 'DENY'
  }
  if (frameAncestors.length === 1 && frameAncestors[0] === 'self') {
    return 'SAMEORIGIN'
  }
  // Explicit origin list — X-Frame-Options cannot express this; omit it.
  return null
}

interface StaticHeaders {
  readonly noSniff: string
  readonly xssProtection: string
  readonly referrerPolicy: string
  readonly permissionsPolicy: string
  readonly hsts: string
  readonly xFrameOptions: string | null
}

function buildStaticHeaders(config: Config): StaticHeaders {
  const fa = config.csp.frameAncestors
  return {
    noSniff: 'nosniff',
    xssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
    hsts: `max-age=${DEFAULTS.HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    xFrameOptions: resolveFrameOptions(fa),
  }
}

// ---------------------------------------------------------------------------
// CSP string precomputation
// ---------------------------------------------------------------------------

interface PrecomputedCsp {
  readonly headerName: string | null
  /** CSP value for TLS connections (wss://, https:// only). */
  readonly secureValue: string
  /** CSP value for plain-HTTP connections (adds ws://, http://). */
  readonly insecureValue: string
  readonly reportingEndpoints: string | null
}

function appendSsoFormAction(directives: Record<string, string[]>): Record<string, string[]> {
  const fa = directives['form-action'] as string[]
  const updated = fa.includes('https:') ? fa : [...fa, 'https:']
  return { ...directives, 'form-action': updated }
}

function precomputeCspStrings(config: Config): PrecomputedCsp {
  const mode: CspMode = config.csp.mode

  if (mode === 'off') {
    return { headerName: null, secureValue: '', insecureValue: '', reportingEndpoints: null }
  }

  const headerName =
    mode === 'report-only'
      ? HEADERS.CONTENT_SECURITY_POLICY_REPORT_ONLY
      : HEADERS.CONTENT_SECURITY_POLICY

  const isSso =
    config.sso.enabled === true &&
    Array.isArray(config.sso.trustedProxies) &&
    config.sso.trustedProxies.length > 0

  function buildValue(secure: boolean): string {
    let directives = buildCspDirectives(config, secure)
    if (isSso) {
      directives = appendSsoFormAction(directives)
    }
    return cspHeaderValue(directives)
  }

  const reportUri = config.csp.reportUri

  return {
    headerName,
    secureValue: buildValue(true),
    insecureValue: buildValue(false),
    reportingEndpoints: `csp-endpoint="${reportUri}"`,
  }
}

// ---------------------------------------------------------------------------
// Public middleware factory
// ---------------------------------------------------------------------------

/**
 * Build and return a security-headers middleware.
 *
 * The CSP directive string is precomputed ONCE at construction time (for both
 * TLS and plain-HTTP variants) so that the per-request path does no allocation.
 * All other headers are constant strings resolved from config here as well.
 */
export function createSecurityHeadersMiddleware(config: Config): RequestHandler {
  const precomputed = precomputeCspStrings(config)
  const staticHeaders = buildStaticHeaders(config)

  return (req, res, next) => {
    // Static headers (no per-request logic needed)
    res.setHeader(HEADERS.X_CONTENT_TYPE_OPTIONS, staticHeaders.noSniff)
    res.setHeader(HEADERS.X_XSS_PROTECTION, staticHeaders.xssProtection)
    res.setHeader(HEADERS.REFERRER_POLICY, staticHeaders.referrerPolicy)
    res.setHeader(HEADERS.PERMISSIONS_POLICY, staticHeaders.permissionsPolicy)

    if (staticHeaders.xFrameOptions !== null) {
      res.setHeader(HEADERS.X_FRAME_OPTIONS, staticHeaders.xFrameOptions)
    }

    if (req.secure) {
      res.setHeader(HEADERS.STRICT_TRANSPORT_SECURITY, staticHeaders.hsts)
    }

    // CSP (pick precomputed value by TLS context)
    const { headerName, secureValue, insecureValue, reportingEndpoints } = precomputed
    if (headerName !== null) {
      const cspValue = req.secure ? secureValue : insecureValue
      res.setHeader(headerName, cspValue)
      if (reportingEndpoints !== null) {
        res.setHeader(HEADERS.REPORTING_ENDPOINTS, reportingEndpoints)
      }
    }

    debug('Security headers applied to %s %s', req.method, req.url)
    next()
  }
}
