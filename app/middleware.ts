// app/middleware.ts
// Backward compatibility wrapper for middleware functions
// Individual middleware have been moved to app/middleware/

export {
  createAuthMiddleware,
  createSessionMiddleware,
  createBodyParserMiddleware,
  createCookieMiddleware,
  createSSOAuthMiddleware,
  createCSRFMiddleware,
  applyMiddleware,
} from './middleware/index.js'
