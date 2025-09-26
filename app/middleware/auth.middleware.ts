// app/middleware/auth.middleware.ts
// Authentication middleware for handling basic auth

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import basicAuth from 'basic-auth'
import { HTTP } from '../constants.js'
import type { Config } from '../types/config.js'
import { processAuthentication, createSessionData } from './auth-processor.js'
import { isErr } from '../utils/result.js'

/**
 * Create authentication middleware that handles basic auth
 * @param config - Application configuration
 * @returns Express middleware handler
 */
export function createAuthMiddleware(config: Config): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const r = req as Request & { session?: Record<string, unknown> }
    
    // Extract basic auth credentials from request
    const credentials = basicAuth(req) as { name?: string; pass?: string } | undefined
    
    // Process authentication using pure function
    const authResult = processAuthentication(config, credentials)
    
    if (isErr(authResult)) {
      // Authentication failed
      res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
      res.status(authResult.error.code).send(authResult.error.message)
      return
    }
    
    // Create session data from auth result
    const sessionData = createSessionData(authResult.value)
    
    // Apply session data
    Object.assign(r.session, sessionData)

    // Explicitly save session to ensure Socket.IO can access it
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (r.session != null && typeof r.session.save === 'function') {
      r.session.save((err: unknown) => {
        if (err != null) {
          console.error('Session save error:', err)
        }
        next()
      })
    } else {
      next()
    }
  }
}