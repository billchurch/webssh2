// app/middleware/session.middleware.ts
// Session management middleware

import type { RequestHandler } from 'express'
import session from 'express-session'
import { DEFAULTS } from '../constants/index.js'
import type { Config } from '../types/config.js'
import { isTrustProxyEnabled } from '../config/trust-proxy.js'
import { createEphemeralSessionStore } from './ephemeral-session-store.js'

/**
 * Create session management middleware
 * @param config - Application configuration
 * @param store - Session store (defaults to a new in-memory store)
 * @returns Express session middleware
 */
export function createSessionMiddleware(
  config: Config,
  store: session.Store = createEphemeralSessionStore()
): RequestHandler {
  // Explicit SameSite (#580). Lax still sends the cookie on the top-level
  // navigation that follows a portal's credential POST, and matches what
  // browsers already apply when the attribute is missing.
  const cookie: session.CookieOptions = {
    // Bound the session lifetime; the store drops entries once it passes.
    maxAge: config.session.sessionTimeout ?? DEFAULTS.SESSION_TIMEOUT_MS,
    httpOnly: true,
    sameSite: 'lax',
  }
  // Behind a trusted TLS-terminating proxy, mark the cookie Secure on
  // requests Express sees as HTTPS. Left unset otherwise so direct
  // deployments keep their current cookie attributes.
  if (isTrustProxyEnabled(config.http.trustProxy)) {
    cookie.secure = 'auto'
  }

  return session({
    secret: config.session.secret,
    resave: false,
    // Only persist sessions a route has written to; requests that never touch
    // the session must not allocate a store entry or set a cookie.
    saveUninitialized: false,
    name: config.session.name,
    cookie,
    store,
  })
}
