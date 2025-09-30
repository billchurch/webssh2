// app/middleware/csrf.middleware.ts
// CSRF protection middleware

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { HTTP, DEFAULTS } from '../constants.js'
import type { Config } from '../types/config.js'

/**
 * Create CSRF protection middleware
 * @param config - Application configuration
 * @returns Express middleware handler
 */
export function createCSRFMiddleware(config: Config): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.sso.csrfProtection) {
      next()
      return
    }

    if (isTrustedProxy(req, config.sso.trustedProxies)) {
      next()
      return
    }

    if (hasSsoHeaders(req)) {
      next()
      return
    }

    if (req.method === 'POST' && !isValidCsrfToken(req)) {
      res.status(HTTP.FORBIDDEN).send('CSRF token validation failed')
      return
    }

    next()
  }
}

type RequestWithSession = Request & {
  session?: Record<string, unknown> | null
  body?: unknown
}

const isTrustedProxy = (req: Request, trustedProxies: readonly string[]): boolean => {
  if (trustedProxies.length === 0) {
    return false
  }
  const candidateIp = getClientIp(req)
  if (candidateIp === undefined) {
    return false
  }
  return trustedProxies.includes(candidateIp)
}

const getClientIp = (req: Request): string | undefined => {
  if (typeof req.ip === 'string' && req.ip !== '') {
    return req.ip
  }
  const connection = req.connection as { remoteAddress?: string } | undefined
  return connection?.remoteAddress
}

const hasSsoHeaders = (req: Request): boolean => {
  const usernameHeader = req.headers[DEFAULTS.SSO_HEADERS.USERNAME]
  const sessionHeader = req.headers[DEFAULTS.SSO_HEADERS.SESSION]
  return usernameHeader != null || sessionHeader != null
}

const isValidCsrfToken = (req: Request): boolean => {
  const enrichedRequest = req as RequestWithSession
  const sessionToken = extractSessionToken(enrichedRequest)
  if (sessionToken === undefined) {
    return false
  }
  const requestToken = extractRequestToken(enrichedRequest)
  return requestToken === sessionToken
}

const extractSessionToken = (req: RequestWithSession): string | undefined => {
  const session = req.session
  if (!isObjectLike(session)) {
    return undefined
  }
  return session['csrfToken'] as string | undefined
}

const extractRequestToken = (req: RequestWithSession): string | undefined => {
  const bodyToken = extractBodyToken(normalizeBody(req.body))
  if (bodyToken !== undefined) {
    return bodyToken
  }
  return toHeaderString(req.headers['x-csrf-token'])
}

const normalizeBody = (body: unknown): Record<string, unknown> | undefined => {
  if (!isPlainRecord(body)) {
    return undefined
  }
  return body
}

const extractBodyToken = (body: Record<string, unknown> | undefined): string | undefined => {
  if (body == null) {
    return undefined
  }
  const csrfCandidate = body['_csrf']
  return typeof csrfCandidate === 'string' && csrfCandidate !== '' ? csrfCandidate : undefined
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

const isObjectLike = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return isObjectLike(value) && !Array.isArray(value)
}
