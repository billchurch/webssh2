// app/middleware/index.ts
// Central exports and orchestration for middleware

import type { Application, RequestHandler } from 'express'
import { createSecurityHeadersMiddleware } from '../security-headers.js'
import { createSessionMiddleware } from './session.middleware.js'
import { createBodyParserMiddleware } from './body-parser.middleware.js'
import { createCookieMiddleware } from './cookie.middleware.js'
import { createSSOAuthMiddleware } from './sso.middleware.js'
import { createCSRFMiddleware } from './csrf.middleware.js'
import type { Config } from '../types/config.js'

// Re-export individual middleware creators
export { createAuthMiddleware } from './auth.middleware.js'
export {
  createSessionMiddleware,
  createBodyParserMiddleware,
  createCookieMiddleware,
  createSSOAuthMiddleware,
  createCSRFMiddleware
}

/**
 * Apply all middleware to the Express application
 * @param app - Express application instance
 * @param config - Application configuration
 * @returns Object containing references to key middleware
 */
export function applyMiddleware(
  app: Application,
  config: Config
): {
  sessionMiddleware: RequestHandler
} {
  // Security headers should be applied first
  app.use(createSecurityHeadersMiddleware(config))
  
  // Session management
  const sessionMiddleware = createSessionMiddleware(config)
  app.use(sessionMiddleware)
  
  // Body parsing
  app.use(createBodyParserMiddleware())
  
  // SSO-related middleware (conditional)
  if (config.sso.enabled) {
    app.use(createCSRFMiddleware(config))
    app.use(createSSOAuthMiddleware(config))
  }
  
  // Cookie management
  app.use(createCookieMiddleware())
  
  return { sessionMiddleware }
}
