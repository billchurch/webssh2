// app/middleware/session.middleware.ts
// Session management middleware

import type { RequestHandler } from 'express'
import session from 'express-session'
import type { Config } from '../types/config.js'
import { createEphemeralSessionStore } from './ephemeral-session-store.js'

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
    // Explicit SameSite (#580). Lax still sends the cookie on the top-level
    // navigation that follows a portal's credential POST, and matches what
    // browsers already apply when the attribute is missing.
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
    },
    store: createEphemeralSessionStore(),
  })
}
