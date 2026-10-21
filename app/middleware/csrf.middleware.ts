// app/middleware/csrf.middleware.ts
// CSRF protection for the credential POST routes (#580).
// Thin adapter around the pure decision in app/security/post-origin.ts.

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { HTTP, DEFAULTS } from '../constants/index.js'
import type { Config } from '../types/config.js'
import { createAppStructuredLogger, createNamespacedDebug } from '../logger.js'
import type { StructuredLogger } from '../logging/structured-logger.js'
import {
  evaluatePostOrigin,
  isPostOriginCheckActive,
  normalizeAllowedPostOrigin,
  type PostOriginDecision,
  type PostOriginPolicy,
  type PostOriginRequest
} from '../security/post-origin.js'

const debug = createNamespacedDebug('middleware:csrf')

export interface CSRFMiddlewareDeps {
  readonly logger?: StructuredLogger
}

/**
 * Create the origin check for the credential POST routes. Mount it only on
 * those routes, and only when isPostOriginCheckActive(config) is true.
 * @param config - Application configuration
 * @param deps - Optional logger (tests inject one)
 * @returns Express middleware handler
 */
export function createCSRFMiddleware(
  config: Config,
  deps: CSRFMiddlewareDeps = {}
): RequestHandler {
  const policy = buildPolicy(config)
  const logger = deps.logger ?? createAppStructuredLogger({ config })

  return (req: Request, res: Response, next: NextFunction) => {
    const request = extractPostOriginRequest(req)
    const decision = evaluatePostOrigin(request, policy)

    if (decision.accept) {
      if (decision.step === 'no-browser-headers') {
        debug('POST %s accepted without Origin or Sec-Fetch-Site (non-browser client)', req.originalUrl)
      }
      next()
      return
    }

    logRejection(logger, req, request, decision)
    res.status(HTTP.FORBIDDEN).json({ error: HTTP.FORBIDDEN_MESSAGE })
  }
}

/**
 * Middleware list for a credential POST route: the origin check when it is
 * active, otherwise nothing (POST behavior unchanged).
 */
export function createPostOriginGuards(config: Config): RequestHandler[] {
  return isPostOriginCheckActive(config) ? [createCSRFMiddleware(config)] : []
}

function buildPolicy(config: Config): PostOriginPolicy {
  // Entries were validated at config load; re-normalizing keeps hand-built
  // configs (tests, embedders) matching the same canonical form.
  const allowedOrigins = (config.http.allowedPostOrigins ?? []).flatMap((entry) => {
    const normalized = normalizeAllowedPostOrigin(entry)
    return normalized.ok ? [normalized.value] : []
  })
  return {
    allowedOrigins,
    ssoEnabled: config.sso.enabled,
    trustedProxies: config.sso.trustedProxies
  }
}

function extractPostOriginRequest(req: Request): PostOriginRequest {
  return {
    origin: toHeaderString(req.headers.origin),
    secFetchSite: toHeaderString(req.headers['sec-fetch-site']),
    clientIp: getClientIp(req),
    hasSsoHeader: hasSsoHeaders(req)
  }
}

function logRejection(
  logger: StructuredLogger,
  req: Request,
  request: PostOriginRequest,
  decision: PostOriginDecision
): void {
  // Never log the body: it carries the posted credentials.
  const result = logger.warn({
    event: 'policy_block',
    message: 'Credential POST rejected by origin check',
    context: {
      subsystem: 'security',
      status: 'failure',
      reason: `post_origin_${decision.step}`,
      ...(request.clientIp === undefined ? {} : { clientIp: request.clientIp })
    },
    data: {
      route: req.originalUrl,
      origin: request.origin ?? null,
      secFetchSite: request.secFetchSite ?? null,
      step: decision.step
    }
  })
  if (!result.ok) {
    debug('Failed to emit origin check rejection log: %O', result.error)
  }
}

const getClientIp = (req: Request): string | undefined => {
  if (typeof req.ip === 'string' && req.ip !== '') {
    return req.ip
  }
  const socket = req.socket as { remoteAddress?: string } | undefined
  return socket?.remoteAddress
}

const hasSsoHeaders = (req: Request): boolean => {
  const usernameHeader = req.headers[DEFAULTS.SSO_HEADERS.USERNAME]
  const sessionHeader = req.headers[DEFAULTS.SSO_HEADERS.SESSION]
  return usernameHeader != null || sessionHeader != null
}

const toHeaderString = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value[0]
  }
  return undefined
}
