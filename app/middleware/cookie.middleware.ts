// app/middleware/cookie.middleware.ts
// Cookie management middleware

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { HTTP } from '../constants.js'

/**
 * Create cookie middleware for storing connection information
 * @returns Express middleware handler
 */
export function createCookieMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = req as Request & { session?: Record<string, unknown> }
    const s = r.session as Record<string, unknown>
    const creds = s['sshCredentials'] as { host?: string; port?: number } | undefined
    
    if (creds != null) {
      const cookieData = { host: creds.host, port: creds.port }
      res.cookie(HTTP.COOKIE, JSON.stringify(cookieData), {
        httpOnly: false,
        path: HTTP.PATH,
        sameSite: HTTP.SAMESITE_POLICY.toLowerCase() as 'strict',
      })
    }
    
    next()
  }
}