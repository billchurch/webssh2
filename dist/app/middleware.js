// server
// app/middleware.ts
import createDebug from 'debug'
import session from 'express-session'
import bodyParser from 'body-parser'
import basicAuth from 'basic-auth'
import validator from 'validator'
import { HTTP } from './constants.js'
import { createSecurityHeadersMiddleware } from './security-headers.js'
const { urlencoded, json } = bodyParser
const debug = createDebug('webssh2:middleware')
/**
 * Middleware function that handles HTTP Basic Authentication for the application.
 *
 * If the `config.user.name` and `config.user.password` are set, it will use those
 * credentials to authenticate the request and set the `req.session.sshCredentials`
 * object with the username and password.
 *
 * If the `config.user.name` and `config.user.password` are not set, it will attempt
 * to use HTTP Basic Authentication to authenticate the request. It will validate and
 * sanitize the credentials, and set the `req.session.sshCredentials` object with the
 * username and password.
 *
 * The function will also set the `req.session.usedBasicAuth` flag to indicate that
 * Basic Authentication was used.
 *
 * If the authentication fails, the function will send a 401 Unauthorized response
 * with the appropriate WWW-Authenticate header.
 */
export function createAuthMiddleware(config) {
  return (req, res, next) => {
    // Check if username and either password or private key is configured
    if (config.user.name && (config.user.password || config.user.privateKey)) {
      req.session.sshCredentials = {
        username: config.user.name,
      }
      // Add credentials based on what's available
      if (config.user.privateKey) {
        req.session.sshCredentials.privateKey = config.user.privateKey
      }
      if (config.user.password) {
        req.session.sshCredentials.password = config.user.password
      }
      req.session.usedBasicAuth = true
      return next()
    }
    // Scenario 2: Basic Auth
    // If no configured credentials, fall back to Basic Auth
    debug('auth: Basic Auth')
    const credentials = basicAuth(req)
    if (!credentials) {
      res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
      res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
      return
    }
    // Validate and sanitize credentials
    req.session.sshCredentials = {
      username: validator.escape(credentials.name),
      password: credentials.pass,
    }
    req.session.usedBasicAuth = true
    next()
  }
}
/**
 * Creates and configures session middleware
 * @param config - The configuration object
 * @returns The session middleware
 */
export function createSessionMiddleware(config) {
  return session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: true,
    name: config.session.name,
  })
}
/**
 * Creates body parser middleware
 * @returns Array of body parser middleware
 */
export function createBodyParserMiddleware() {
  return [urlencoded({ extended: true }), json()]
}
/**
 * Creates cookie-setting middleware
 * @returns The cookie-setting middleware
 */
export function createCookieMiddleware() {
  return (req, res, next) => {
    if (req.session.sshCredentials) {
      const cookieData = {
        host: req.session.sshCredentials.host,
        port: req.session.sshCredentials.port,
      }
      res.cookie(HTTP.COOKIE, JSON.stringify(cookieData), {
        httpOnly: false,
        path: HTTP.PATH,
        sameSite: HTTP.SAMESITE.toLowerCase(),
      })
    }
    next()
  }
}
/**
 * Creates SSO authentication middleware for POST requests
 * Extracts credentials from POST body or APM headers
 * @param config - The configuration object
 * @returns The SSO middleware
 */
export function createSSOAuthMiddleware(config) {
  return (req, _res, next) => {
    // Skip if not a POST request
    if (req.method !== 'POST') {
      return next()
    }
    // Check for APM header credentials first
    if (req.headers['x-apm-username'] && req.headers['x-apm-password']) {
      debug('SSO Auth: Found APM header credentials')
      // Headers will be processed in the route handler
      return next()
    }
    // Check for form-encoded credentials
    if (req.body?.username && req.body?.password) {
      debug('SSO Auth: Found POST body credentials')
      // Body will be processed in the route handler
      return next()
    }
    // If SSO is enabled and no credentials found, check config for defaults
    if (config.sso?.enabled) {
      if (config.user?.name && config.user?.password) {
        debug('SSO Auth: Using configured default credentials')
        req.body = req.body || {}
        req.body.username = req.body.username || config.user.name
        req.body.password = req.body.password || config.user.password
        return next()
      }
    }
    next()
  }
}
/**
 * Creates CSRF protection middleware for SSO
 * @param config - The configuration object
 * @returns The CSRF middleware
 */
export function createCSRFMiddleware(config) {
  return (req, res, next) => {
    // Skip CSRF if disabled in config
    if (!config.sso?.csrfProtection) {
      return next()
    }
    // Skip CSRF for trusted proxies (e.g., BIG-IP APM)
    if (config.sso?.trustedProxies?.length && config.sso.trustedProxies.length > 0) {
      const clientIp = req.ip || req.connection?.remoteAddress
      if (clientIp && config.sso.trustedProxies.includes(clientIp)) {
        debug('CSRF: Skipping for trusted proxy: %s', clientIp)
        return next()
      }
    }
    // Skip CSRF if APM headers are present (trusted SSO source)
    if (req.headers['x-apm-username'] || req.headers['x-apm-session']) {
      debug('CSRF: Skipping for APM authenticated request')
      return next()
    }
    // For POST requests, check CSRF token if enabled
    if (req.method === 'POST') {
      const token = req.body._csrf || req.headers['x-csrf-token']
      const sessionToken = req.session.csrfToken
      if (!sessionToken || token !== sessionToken) {
        debug('CSRF: Token validation failed')
        res.status(HTTP.FORBIDDEN).send('CSRF token validation failed')
        return
      }
    }
    next()
  }
}
/**
 * Applies all middleware to the Express app
 * @param app - The Express application
 * @param config - The configuration object
 * @returns An object containing the session middleware
 */
export function applyMiddleware(app, config) {
  // Apply security headers first (before session to ensure they're always set)
  app.use(createSecurityHeadersMiddleware(config))
  const sessionMiddleware = createSessionMiddleware(config)
  app.use(sessionMiddleware)
  const bodyParsers = createBodyParserMiddleware()
  bodyParsers.forEach((parser) => app.use(parser))
  // Add SSO and CSRF middleware if SSO is enabled
  if (config.sso?.enabled) {
    app.use(createCSRFMiddleware(config))
    app.use(createSSOAuthMiddleware(config))
    debug('applyMiddleware: SSO and CSRF middleware enabled')
  }
  app.use(createCookieMiddleware())
  debug(
    `applyMiddleware applied: security headers, session, body parser, cookies${config.sso?.enabled ? ', SSO, CSRF' : ''}`
  )
  return { sessionMiddleware }
}
//# sourceMappingURL=middleware.js.map
