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
      return res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
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
 * @param {Object} config - The configuration object
 * @returns {Function} The session middleware
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
export function createBodyParserMiddleware() {
  return [urlencoded({ extended: true }), json()]
}

/**
 * Creates cookie-setting middleware
 * @returns {Function} The cookie-setting middleware
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
        sameSite: HTTP.SAMESITE,
      })
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
export function applyMiddleware(app, config) {
  // Apply security headers first (before session to ensure they're always set)
  app.use(createSecurityHeadersMiddleware())

  const sessionMiddleware = createSessionMiddleware(config)
  app.use(sessionMiddleware)

  app.use(createBodyParserMiddleware())
  app.use(createCookieMiddleware())

  debug('applyMiddleware applied: security headers, session, body parser, cookies')

  return { sessionMiddleware }
}
