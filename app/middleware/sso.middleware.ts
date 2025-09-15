// app/middleware/sso.middleware.ts
// Single Sign-On (SSO) authentication middleware

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { DEFAULTS } from '../constants.js'
import type { Config } from '../types/config.js'

/**
 * Create SSO authentication middleware
 * @param config - Application configuration
 * @returns Express middleware handler
 */
export function createSSOAuthMiddleware(config: Config): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.method !== 'POST') {
      return next()
    }

    // Check for SSO headers
    if (
      req.headers[DEFAULTS.SSO_HEADERS.USERNAME] != null && 
      req.headers[DEFAULTS.SSO_HEADERS.PASSWORD] != null
    ) {
      return next()
    }

    // Check for credentials in body
    const body = (req as Request & { body?: Record<string, unknown> }).body as 
      Record<string, unknown> | undefined
    if (
      body?.['username'] != null && 
      body['username'] !== '' && 
      body['password'] != null && 
      body['password'] !== ''
    ) {
      return next()
    }

    // Apply default credentials if SSO is enabled
    if (config.sso.enabled && config.user.name != null && config.user.password != null) {
      const r = req as Request & { body?: Record<string, unknown> }
      r.body ??= {}
      if (r.body != null) {
        const body = r.body as Record<string, unknown>
        body['username'] = (body['username'] as string | undefined) ?? config.user.name
        body['password'] = (body['password'] as string | undefined) ?? config.user.password
      }
      return next()
    }

    next()
  }
}