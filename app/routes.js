// server
// app/routes.js

import express from 'express'
import {
  getValidatedHost,
  getValidatedPort,
  maskSensitiveData,
  validateSshTerm,
  parseEnvVars,
} from './utils.js'
import handleConnection from './connectionHandler.js'
import { createNamespacedDebug } from './logger.js'
import { createAuthMiddleware } from './middleware.js'
import { ConfigError, handleError } from './errors.js'
import { HTTP } from './constants.js'

const debug = createNamespacedDebug('routes')

export function createRoutes(config) {
  const router = express.Router()
  const auth = createAuthMiddleware(config)

  // Scenario 1: No auth required, uses websocket authentication instead
  router.get('/', (req, res) => {
    debug('router.get./: Accessed / route')

    // Process header parameters from URL
    if (req.query.header || req.query.headerBackground || req.query.headerStyle) {
      req.session.headerOverride = {}
      if (req.query.header) {
        req.session.headerOverride.text = req.query.header
        debug('Header text from URL parameter: %s', req.query.header)
      }
      if (req.query.headerBackground) {
        req.session.headerOverride.background = req.query.headerBackground
        debug('Header background from URL parameter: %s', req.query.headerBackground)
      }
      if (req.query.headerStyle) {
        req.session.headerOverride.style = req.query.headerStyle
        debug('Header style from URL parameter: %s', req.query.headerStyle)
      }
      debug('Header override set in session: %O', req.session.headerOverride)
    }

    handleConnection(req, res)
  })

  /**
   * Handles the "/host/" route, which requires authentication and uses the
   * `auth` middleware function to handle HTTP Basic Authentication.
   *
   * This route validates the host and port parameters, sets the `sshCredentials`
   * object in the session, and calls the `handleConnection` function to handle
   * the connection.
   *
   * If the `config.ssh.host` is not set, it throws a `ConfigError` with the
   * appropriate error message.
   *
   * @param {Object} req - The Express request object
   * @param {Object} res - The Express response object
   */
  router.get('/host/', auth, (req, res) => {
    debug(`router.get.host: /ssh/host/ route`)
    const envVars = parseEnvVars(req.query.env)
    if (envVars) {
      req.session.envVars = envVars
      debug('routes: Parsed environment variables: %O', envVars)
    }

    // Process header parameters from URL
    if (req.query.header || req.query.headerBackground || req.query.headerStyle) {
      req.session.headerOverride = {}
      if (req.query.header) {
        req.session.headerOverride.text = req.query.header
        debug('Header text from URL parameter: %s', req.query.header)
      }
      if (req.query.headerBackground) {
        req.session.headerOverride.background = req.query.headerBackground
        debug('Header background from URL parameter: %s', req.query.headerBackground)
      }
      if (req.query.headerStyle) {
        req.session.headerOverride.style = req.query.headerStyle
        debug('Header style from URL parameter: %s', req.query.headerStyle)
      }
      debug('Header override set in session: %O', req.session.headerOverride)
    }

    try {
      if (!config.ssh.host) {
        throw new ConfigError('Host parameter required when default host not configured')
      }

      const { host } = config.ssh
      const port = getValidatedPort(req.query.port)
      const sshterm = validateSshTerm(req.query.sshterm)

      req.session.sshCredentials = req.session.sshCredentials || {}
      req.session.sshCredentials.host = host
      req.session.sshCredentials.port = port
      if (req.query.sshterm) {
        req.session.sshCredentials.term = sshterm
      }
      req.session.usedBasicAuth = true

      const sanitizedCredentials = maskSensitiveData(
        JSON.parse(JSON.stringify(req.session.sshCredentials))
      )
      debug('/ssh/host/ Credentials: ', sanitizedCredentials)

      handleConnection(req, res, { host: host })
    } catch (err) {
      const error = new ConfigError(`Invalid configuration: ${err.message}`)
      handleError(error, res)
    }
  })

  // Scenario 2: Auth required, uses HTTP Basic Auth
  router.get('/host/:host', auth, (req, res) => {
    debug(`router.get.host: /ssh/host/${req.params.host} route`)
    const envVars = parseEnvVars(req.query.env)
    if (envVars) {
      req.session.envVars = envVars
      debug('routes: Parsed environment variables: %O', envVars)
    }

    // Process header parameters from URL
    if (req.query.header || req.query.headerBackground || req.query.headerStyle) {
      req.session.headerOverride = {}
      if (req.query.header) {
        req.session.headerOverride.text = req.query.header
        debug('Header text from URL parameter: %s', req.query.header)
      }
      if (req.query.headerBackground) {
        req.session.headerOverride.background = req.query.headerBackground
        debug('Header background from URL parameter: %s', req.query.headerBackground)
      }
      if (req.query.headerStyle) {
        req.session.headerOverride.style = req.query.headerStyle
        debug('Header style from URL parameter: %s', req.query.headerStyle)
      }
      debug('Header override set in session: %O', req.session.headerOverride)
    }

    try {
      const host = getValidatedHost(req.params.host)
      const port = getValidatedPort(req.query.port)

      // Validate and sanitize sshterm parameter if it exists
      const sshterm = validateSshTerm(req.query.sshterm)

      req.session.sshCredentials = req.session.sshCredentials || {}
      req.session.sshCredentials.host = host
      req.session.sshCredentials.port = port
      if (req.query.sshterm) {
        req.session.sshCredentials.term = sshterm
      }
      req.session.usedBasicAuth = true

      // Sanitize and log the sshCredentials object
      const sanitizedCredentials = maskSensitiveData(
        JSON.parse(JSON.stringify(req.session.sshCredentials))
      )
      debug('/ssh/host/ Credentials: ', sanitizedCredentials)

      handleConnection(req, res, { host: host })
    } catch (err) {
      const error = new ConfigError(`Invalid configuration: ${err.message}`)
      handleError(error, res)
    }
  })

  // POST route for SSO authentication (e.g., BIG-IP APM)
  // This route accepts form-encoded credentials instead of Basic Auth
  router.post('/host/', (req, res) => {
    debug(`router.post.host: /ssh/host/ route`)

    try {
      if (!config.ssh.host) {
        throw new ConfigError('Host parameter required when default host not configured')
      }

      // Extract credentials from POST body or APM headers
      const username = req.body.username || req.headers['x-apm-username']
      const password = req.body.password || req.headers['x-apm-password']

      if (!username || !password) {
        return res.status(HTTP.UNAUTHORIZED).send('Username and password required')
      }

      const host = req.body.host || config.ssh.host
      const port = getValidatedPort(req.body.port)
      const sshterm = validateSshTerm(req.body.sshterm || req.body['sshterm'])

      // Process header parameters from POST body
      if (req.body['header.name'] || req.body['header.background'] || req.body['header.color']) {
        req.session.headerOverride = {}
        if (req.body['header.name']) {
          req.session.headerOverride.text = req.body['header.name']
          debug('Header text from POST: %s', req.body['header.name'])
        }
        if (req.body['header.background']) {
          req.session.headerOverride.background = req.body['header.background']
          debug('Header background from POST: %s', req.body['header.background'])
        }
        if (req.body['header.color']) {
          req.session.headerOverride.style = `color: ${req.body['header.color']}`
          debug('Header color from POST: %s', req.body['header.color'])
        }
      }

      // Parse environment variables if provided
      const envVars = parseEnvVars(req.body.env)
      if (envVars) {
        req.session.envVars = envVars
        debug('routes: Parsed environment variables from POST: %O', envVars)
      }

      // Store credentials in session (same structure as Basic Auth)
      req.session.sshCredentials = {
        username: username,
        password: password,
        host: host,
        port: port,
      }

      if (sshterm) {
        req.session.sshCredentials.term = sshterm
      }

      // Set flag indicating authentication method
      req.session.usedBasicAuth = true // Keep same flag for compatibility
      req.session.authMethod = 'POST' // Track actual auth method

      const sanitizedCredentials = maskSensitiveData(
        JSON.parse(JSON.stringify(req.session.sshCredentials))
      )
      debug('/ssh/host/ POST Credentials: ', sanitizedCredentials)

      // Handle session recording parameters
      if (req.body.allowreplay === 'true' || req.body.allowreplay === true) {
        req.session.allowReplay = true
      }
      if (req.body.mrhsession) {
        req.session.mrhSession = req.body.mrhsession
      }
      if (req.body.readyTimeout) {
        req.session.readyTimeout = parseInt(req.body.readyTimeout, 10)
      }

      handleConnection(req, res, { host: host })
    } catch (err) {
      const error = new ConfigError(`Invalid configuration: ${err.message}`)
      handleError(error, res)
    }
  })

  // POST route with specific host
  router.post('/host/:host', (req, res) => {
    debug(`router.post.host: /ssh/host/${req.params.host} route`)

    try {
      // Extract credentials from POST body or APM headers
      const username = req.body.username || req.headers['x-apm-username']
      const password = req.body.password || req.headers['x-apm-password']

      if (!username || !password) {
        return res.status(HTTP.UNAUTHORIZED).send('Username and password required')
      }

      const host = getValidatedHost(req.params.host)
      const port = getValidatedPort(req.body.port)
      const sshterm = validateSshTerm(req.body.sshterm || req.body['sshterm'])

      // Process header parameters from POST body
      if (req.body['header.name'] || req.body['header.background'] || req.body['header.color']) {
        req.session.headerOverride = {}
        if (req.body['header.name']) {
          req.session.headerOverride.text = req.body['header.name']
          debug('Header text from POST: %s', req.body['header.name'])
        }
        if (req.body['header.background']) {
          req.session.headerOverride.background = req.body['header.background']
          debug('Header background from POST: %s', req.body['header.background'])
        }
        if (req.body['header.color']) {
          req.session.headerOverride.style = `color: ${req.body['header.color']}`
          debug('Header color from POST: %s', req.body['header.color'])
        }
      }

      // Parse environment variables if provided
      const envVars = parseEnvVars(req.body.env)
      if (envVars) {
        req.session.envVars = envVars
        debug('routes: Parsed environment variables from POST: %O', envVars)
      }

      // Store credentials in session (same structure as Basic Auth)
      req.session.sshCredentials = {
        username: username,
        password: password,
        host: host,
        port: port,
      }

      if (sshterm) {
        req.session.sshCredentials.term = sshterm
      }

      // Set flag indicating authentication method
      req.session.usedBasicAuth = true // Keep same flag for compatibility
      req.session.authMethod = 'POST' // Track actual auth method

      const sanitizedCredentials = maskSensitiveData(
        JSON.parse(JSON.stringify(req.session.sshCredentials))
      )
      debug('/ssh/host/:host POST Credentials: ', sanitizedCredentials)

      // Handle session recording parameters
      if (req.body.allowreplay === 'true' || req.body.allowreplay === true) {
        req.session.allowReplay = true
      }
      if (req.body.mrhsession) {
        req.session.mrhSession = req.body.mrhsession
      }
      if (req.body.readyTimeout) {
        req.session.readyTimeout = parseInt(req.body.readyTimeout, 10)
      }

      handleConnection(req, res, { host: host })
    } catch (err) {
      const error = new ConfigError(`Invalid configuration: ${err.message}`)
      handleError(error, res)
    }
  })

  // Clear credentials route
  router.get('/clear-credentials', (req, res) => {
    req.session.sshCredentials = null
    res.status(HTTP.OK).send(HTTP.CREDENTIALS_CLEARED)
  })

  router.get('/force-reconnect', (req, res) => {
    req.session.sshCredentials = null
    res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
  })

  return router
}
