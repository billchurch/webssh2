// app/middleware/sso.middleware.ts
// Single Sign-On (SSO) authentication middleware

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { DEFAULTS } from '../constants/index.js'
import type { Config } from '../types/config.js'

/**
 * Create SSO authentication middleware
 * @param config - Application configuration
 * @returns Express middleware handler
 */
export function createSSOAuthMiddleware(config: Config): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!isPost(req)) {
      next()
      return
    }

    if (containsSsoHeaders(req) || hasCredentialsInBody(req)) {
      next()
      return
    }

    if (shouldApplyDefaults(config)) {
      applyDefaultCredentials(req, config)
    }

    next()
  }
}

type RequestWithMutableBody = Request & { body?: unknown }

const isPost = (req: Request): boolean => req.method === 'POST'

const containsSsoHeaders = (req: Request): boolean => {
  const usernameHeader = req.headers[DEFAULTS.SSO_HEADERS.USERNAME]
  const passwordHeader = req.headers[DEFAULTS.SSO_HEADERS.PASSWORD]
  return usernameHeader != null && passwordHeader != null
}

const hasCredentialsInBody = (req: Request): boolean => {
  const body = normalizeBody((req as RequestWithMutableBody).body)
  if (body === undefined) {
    return false
  }

  const username = toFilledString(body['username'])
  const password = toFilledString(body['password'])
  return username !== undefined && password !== undefined
}

const shouldApplyDefaults = (config: Config): boolean => {
  if (!config.sso.enabled) {
    return false
  }
  return toFilledString(config.user.name) !== undefined &&
    toFilledString(config.user.password) !== undefined
}

const applyDefaultCredentials = (req: Request, config: Config): void => {
  const enrichedRequest = req as RequestWithMutableBody
  const body = ensureMutableBody(enrichedRequest)
  const currentUsername = toFilledString(body['username'])
  const currentPassword = toFilledString(body['password'])

  if (currentUsername === undefined) {
    body['username'] = config.user.name
  }
  if (currentPassword === undefined) {
    body['password'] = config.user.password
  }
}

const ensureMutableBody = (req: RequestWithMutableBody): Record<string, unknown> => {
  const normalized = normalizeBody(req.body)
  if (normalized !== undefined) {
    req.body = normalized
    return normalized
  }

  const newBody: Record<string, unknown> = {}
  req.body = newBody
  return newBody
}

const normalizeBody = (body: unknown): Record<string, unknown> | undefined => {
  if (body === undefined || body === null) {
    return undefined
  }
  if (typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>
  }
  return undefined
}

const toFilledString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  if (value === '') {
    return undefined
  }
  return value
}
