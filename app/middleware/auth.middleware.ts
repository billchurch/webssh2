// app/middleware/auth.middleware.ts
// Authentication middleware for handling basic auth

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import basicAuth from 'basic-auth'
import { HTTP } from '../constants/index.js'
import type { Config } from '../types/config.js'
import { processAuthentication, createSessionData } from './auth-processor.js'
import { isErr } from '../utils/index.js'
import { createNamespacedDebug } from '../logger.js'

type SavableSession = Record<string, unknown> & {
  save?: (callback: (err: unknown) => void) => void
}

const debug = createNamespacedDebug('middleware:auth')

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
    const sessionData = createSessionData(authResult.value, config)
    
    const session = r.session as SavableSession | undefined
    if (session == null) {
      next()
      return
    }

    // Skip credential repopulation if auth recently failed
    // This prevents cached Basic Auth from being re-used after SSH auth failure
    if (session['authFailed'] === true) {
      debug('Skipping credential repopulation due to recent auth failure')
      // Clear the flag so user can try again
      session['authFailed'] = undefined
      session['usedBasicAuth'] = false
      session['sshCredentials'] = undefined
    } else {
      Object.assign(session, sessionData)
    }

    if (typeof session.save !== 'function') {
      next()
      return
    }

    session.save((err: unknown) => {
      if (err != null) {
        debug('Session save error: %O', err)
      }
      next()
    })
  }
}
