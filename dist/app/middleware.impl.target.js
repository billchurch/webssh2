// server
// app/middleware.js

// Scenario 2: Basic Auth

import createDebug from 'debug'
import session from 'express-session'
import bodyParser from 'body-parser'

const { urlencoded, json } = bodyParser
const debug = createDebug('webssh2:middleware')
import basicAuth from 'basic-auth'

import validator from 'validator'

import { HTTP } from './constants.js'
import { createSecurityHeadersMiddleware } from './security-headers.js'

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 * @typedef {import('express').RequestHandler} RequestHandler
 * @typedef {import('./types/config.js').Config} Config
 */

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
/**
 * Basic/Auth middleware builder
 * @param {Config} config
 * @returns {RequestHandler}
 */
export function createAuthMiddleware(config) {
  return (
    /** @type {Request & { session?: any }} */ req,
    /** @type {Response} */ res,
    /** @type {NextFunction} */ next
  ) => {
    // Check if username and either password or private key is configured
    if (config.user.name && (config.user.password || config.user.privateKey)) {
      req.session = req.session || {}
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
      return res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
    }

    // Validate and sanitize credentials
    req.session = req.session || {}
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
 * @param {Object} config - The configuration object
 * @returns {Function} The session middleware
 */
/**
 * @param {Config} config
 * @returns {RequestHandler}
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
 * @returns {Function[]} Array of body parser middleware
 */
/**
 * @returns {RequestHandler[]}
 */
export function createBodyParserMiddleware() {
  return [urlencoded({ extended: true }), json()]
}

/**
 * Creates cookie-setting middleware
 * @returns {Function} The cookie-setting middleware
 */
/**
 * @returns {RequestHandler}
 */
export function createCookieMiddleware() {
  return (
    /** @type {Request & { session?: any }} */ req,
    /** @type {Response} */ res,
    /** @type {NextFunction} */ next
  ) => {
    if (req.session?.sshCredentials) {
      const cookieData = {
        host: req.session.sshCredentials.host,
        port: req.session.sshCredentials.port,
      }
      res.cookie(HTTP.COOKIE, JSON.stringify(cookieData), {
        httpOnly: false,
        path: HTTP.PATH,
        sameSite: HTTP.SAMESITE,
      })
    }
    next()
  }
}

/**
 * Creates SSO authentication middleware for POST requests
 * Extracts credentials from POST body or APM headers
 * @param {Object} config - The configuration object
 * @returns {Function} The SSO middleware
 */
/**
 * @param {Config} config
 * @returns {RequestHandler}
 */
export function createSSOAuthMiddleware(config) {
  return (
    /** @type {Request} */ req,
    /** @type {Response} */ res,
    /** @type {NextFunction} */ next
  ) => {
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
        // ensure body exists when using defaults
        req.body = /** @type {any} */ (req.body || {})
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
 * @param {Object} config - The configuration object
 * @returns {Function} The CSRF middleware
 */
/**
 * @param {Config} config
 * @returns {RequestHandler}
 */
export function createCSRFMiddleware(config) {
  return (
    /** @type {Request & { session?: any }} */ req,
    /** @type {Response} */ res,
    /** @type {NextFunction} */ next
  ) => {
    // Skip CSRF if disabled in config
    if (!config.sso?.csrfProtection) {
      return next()
    }

    // Skip CSRF for trusted proxies (e.g., BIG-IP APM)
    if (config.sso?.trustedProxies?.length > 0) {
      const clientIp = req.ip || req.connection?.remoteAddress
      if (config.sso.trustedProxies.includes(clientIp)) {
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
      const token = /** @type {any} */ (req.body?._csrf) || req.headers['x-csrf-token']
      const sessionToken = req.session?.csrfToken

      if (!sessionToken || token !== sessionToken) {
        debug('CSRF: Token validation failed')
        return res.status(HTTP.FORBIDDEN).send('CSRF token validation failed')
      }
    }

    next()
  }
}

/**
 * Applies all middleware to the Express app
 * @param {express.Application} app - The Express application
 * @param {Object} config - The configuration object
 * @returns {Object} An object containing the session middleware
 */
/**
 * Applies all middleware
 * @param {import('express').Application} app
 * @param {Config} config
 * @returns {{ sessionMiddleware: RequestHandler }}
 */
export function applyMiddleware(app, config) {
  // Apply security headers first (before session to ensure they're always set)
  app.use(createSecurityHeadersMiddleware(config))

  const sessionMiddleware = createSessionMiddleware(config)
  app.use(sessionMiddleware)

  app.use(createBodyParserMiddleware())

  // Add SSO and CSRF middleware if SSO is enabled
  if (config.sso?.enabled) {
    app.use(createCSRFMiddleware(config))
    app.use(createSSOAuthMiddleware(config))
    debug('applyMiddleware: SSO and CSRF middleware enabled')
  }

  app.use(createCookieMiddleware())

  debug(
    `applyMiddleware applied: security headers, session, body parser, cookies${
      config.sso?.enabled ? ', SSO, CSRF' : ''
    }`
  )

  return { sessionMiddleware }
}
