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
