// app/middleware/session.middleware.ts
// Session management middleware

import type { RequestHandler } from 'express'
import session from 'express-session'
import type { Config } from '../types/config.js'

/**
 * Create session management middleware
 * @param config - Application configuration
 * @returns Express session middleware
 */
export function createSessionMiddleware(config: Config): RequestHandler {
  return session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: true,
    name: config.session.name,
  })
}