// app/middleware/session.middleware.ts
// Session management middleware

import type { RequestHandler } from 'express'
import session from 'express-session'
import type { Config } from '../types/config.js'
import { isTrustProxyEnabled } from '../config/trust-proxy.js'
import { createEphemeralSessionStore } from './ephemeral-session-store.js'

/**
 * Create session management middleware
 * @param config - Application configuration
 * @returns Express session middleware
 */
export function createSessionMiddleware(config: Config): RequestHandler {
  const cookie: session.CookieOptions = {}
  // Behind a trusted TLS-terminating proxy, mark the cookie Secure on
  // requests Express sees as HTTPS. Left unset otherwise so direct
  // deployments keep their current cookie attributes.
  if (isTrustProxyEnabled(config.http.trustProxy)) {
    cookie.secure = 'auto'
  }

  return session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: true,
    name: config.session.name,
    store: createEphemeralSessionStore(),
    cookie,
  })
}
