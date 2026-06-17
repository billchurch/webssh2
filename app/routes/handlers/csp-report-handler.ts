// app/routes/handlers/csp-report-handler.ts
// Hardened unauthenticated endpoint for receiving CSP violation reports.
// Security properties:
//   - Rate-limits per IP BEFORE body parsing (DoW1)
//   - Caps body at 8 kb (A1)
//   - Delegates to extractCspReport for whitelist/sanitise (S6)
//   - Always returns 204 + Cache-Control: no-store (P2)
//   - Never leaks server info in the response (A3)
//
// Global-parser residual (A3/DoW1): the app-level json() parser (~100 kb, no
// per-route limit) parses `application/json` bodies BEFORE this route's throttle
// runs, so an attacker sending `Content-Type: application/json` bypasses this
// route's 8 kb cap and per-IP throttle. This is a pre-existing property of the
// global parser shared by ALL /ssh POST routes (e.g. the auth POST), not unique
// to csp-report, so it is NOT refactored here. Real browsers send
// `application/csp-report` or `application/reports+json`, which the global parser
// ignores — those bodies ARE throttled-before-parse and capped at 8 kb. Operators
// should additionally enforce an upstream/reverse-proxy body-size + rate limit in
// front of /ssh to defend against the application/json path.

import bodyParser from 'body-parser'
import type { Router, Request, Response, NextFunction } from 'express'
import { extractCspReport, type ExtractedCspReport } from '../../security/csp-report.js'
import { createRateLimiter, type RateLimiterOptions } from '../../security/rate-limiter.js'
import { createNamespacedDebug } from '../../logger.js'

const { json } = bodyParser
const debug = createNamespacedDebug('security:csp-report')

const CSP_TYPES = ['application/csp-report', 'application/reports+json', 'application/json']
const LEGACY_INLINE_SAMPLE = 'window.webssh2Config'

export interface CspReportRouteOptions {
  readonly rateLimit: RateLimiterOptions
  /** Emits the violation. Production wires this to logCspViolation. */
  readonly onViolation: (
    report: ExtractedCspReport,
    meta: { clientIp?: string; userAgent?: string; isLegacy: boolean }
  ) => void
  /** Injectable clock (ms) for deterministic tests. Defaults to Date.now. */
  readonly now?: () => number
}

function isLegacyInlineViolation(report: ExtractedCspReport): boolean {
  const hasSample = report.scriptSample?.includes(LEGACY_INLINE_SAMPLE) === true
  const isInlineUri = report.blockedUri === 'inline'
  return hasSample || isInlineUri
}

function buildMeta(
  req: Request,
  isLegacy: boolean
): { clientIp?: string; userAgent?: string; isLegacy: boolean } {
  const meta: { clientIp?: string; userAgent?: string; isLegacy: boolean } = { isLegacy }
  if (req.ip !== undefined) {
    meta.clientIp = req.ip
  }
  const ua = req.get('user-agent')
  if (ua !== undefined) {
    meta.userAgent = ua
  }
  return meta
}

/** Register POST /csp-report on the given router (path is relative to the router mount). */
export function registerCspReportRoute(router: Router, options: CspReportRouteOptions): void {
  const limiter = createRateLimiter(options.rateLimit)
  const parser = json({ type: CSP_TYPES, limit: '8kb' })
  const clock = options.now ?? Date.now

  const throttle = (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? 'unknown'
    if (!limiter.allow(ip, clock())) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(204).end()
      return
    }
    next()
  }

  const handleReport = (req: Request, res: Response): void => {
    const report = extractCspReport(req.body)
    const isLegacy = isLegacyInlineViolation(report)
    debug('csp violation (legacy=%s): %o', isLegacy, report)
    const meta = buildMeta(req, isLegacy)
    options.onViolation(report, meta)
    res.setHeader('Cache-Control', 'no-store')
    res.status(204).end()
  }

  router.post('/csp-report', throttle, parser, handleReport)

  // Path-scoped error middleware: the 8 kb json() parser throws
  // PayloadTooLargeError on oversized bodies. Registering this immediately after
  // the route — and scoped to /csp-report — guarantees a 204 + no-store response
  // regardless of where this router sits relative to any app-level error handler,
  // preserving the "always 204, never leak an error page" guarantee (P2/A1).
  router.use(
    '/csp-report',
    (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
      debug('csp-report parser error: %s', err.message)
      if (!res.headersSent) {
        res.setHeader('Cache-Control', 'no-store')
        res.status(204).end()
      }
    }
  )
}
