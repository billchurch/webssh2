// app/middleware/auth.middleware.ts
// Authentication middleware for handling basic auth

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import basicAuth from 'basic-auth'
import validator from 'validator'
import { HTTP } from '../constants.js'
import type { Config } from '../types/config.js'

/**
 * Create authentication middleware that handles basic auth
 * @param config - Application configuration
 * @returns Express middleware handler
 */
export function createAuthMiddleware(config: Config): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = req as Request & { session?: Record<string, unknown> }
    
    // Config-supplied credentials take precedence
    if (
      config.user.name != null && 
      config.user.name !== '' && 
      (
        (config.user.password != null && config.user.password !== '') || 
        (config.user.privateKey != null && config.user.privateKey !== '')
      )
    ) {
      const creds: Record<string, unknown> = { username: config.user.name }
      if (config.user.privateKey != null && config.user.privateKey !== '') {
        creds['privateKey'] = config.user.privateKey
      }
      if (config.user.password != null && config.user.password !== '') {
        creds['password'] = config.user.password
      }
      r.session['sshCredentials'] = creds
      r.session['usedBasicAuth'] = true
      return next()
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const credentials = basicAuth(req) as { name?: string; pass?: string } | undefined
    if (credentials == null) {
      res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
      return res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
    }
    
    // session is expected to exist (session middleware precedes this)
    r.session['sshCredentials'] = {
      username: validator.escape(credentials.name ?? ''),
      password: credentials.pass ?? '',
    }
    r.session['usedBasicAuth'] = true
    next()
  }
}