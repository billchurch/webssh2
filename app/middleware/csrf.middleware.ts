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
      return next()
    }

    // Check if client is a trusted proxy
    if (config.sso.trustedProxies.length > 0) {
      const clientIp = (req.ip ?? 
        (req.connection as { remoteAddress?: string }).remoteAddress)
      if (clientIp != null && config.sso.trustedProxies.includes(clientIp)) {
        return next()
      }
    }

    // Skip CSRF check if SSO headers are present
    if (
      req.headers[DEFAULTS.SSO_HEADERS.USERNAME] != null || 
      req.headers[DEFAULTS.SSO_HEADERS.SESSION] != null
    ) {
      return next()
    }

    // Validate CSRF token for POST requests
    if (req.method === 'POST') {
      const r = req as Request & {
        session?: Record<string, unknown>
        body?: Record<string, unknown>
      }
      
      const token = (r.body != null ? 
        ((r.body as Record<string, unknown>)['_csrf'] as string | undefined) : 
        undefined) ?? req.headers['x-csrf-token']
      
      const sessionToken = (r.session as Record<string, unknown>)['csrfToken'] as 
        string | undefined
      
      if (sessionToken == null || token !== sessionToken) {
        return res.status(HTTP.FORBIDDEN).send('CSRF token validation failed')
      }
    }
    
    next()
  }
}