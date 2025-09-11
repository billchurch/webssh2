// server
// app/routes.js
// @ts-check

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

// Helper functions to reduce code duplication
/**
 * @param {any} source
 * @param {any} session
 */
export function processHeaderParameters(source, session) {
  const isGet = typeof source.header !== 'undefined'
  const headerKey = isGet ? 'header' : 'header.name'
  const backgroundKey = isGet ? 'headerBackground' : 'header.background'
  const styleKey = isGet ? 'headerStyle' : 'header.color'

  if (source[headerKey] || source[backgroundKey] || source[styleKey]) {
    session.headerOverride = {}

    if (source[headerKey]) {
      session.headerOverride.text = source[headerKey]
      debug('Header text from %s: %s', isGet ? 'URL parameter' : 'POST', source[headerKey])
    }

    if (source[backgroundKey]) {
      session.headerOverride.background = source[backgroundKey]
      debug(
        'Header background from %s: %s',
        isGet ? 'URL parameter' : 'POST',
        source[backgroundKey]
      )
    }

    if (source[styleKey]) {
      if (isGet) {
        session.headerOverride.style = source[styleKey]
        debug('Header style from URL parameter: %s', source[styleKey])
      } else {
        session.headerOverride.style = `color: ${source[styleKey]}`
        debug('Header color from POST: %s', source[styleKey])
      }
    }

    debug('Header override set in session: %O', session.headerOverride)
  }
}

/**
 * @param {any} source
 * @param {any} session
 */
export function processEnvironmentVariables(source, session) {
  const envVars = parseEnvVars(source.env)
  if (envVars) {
    session.envVars = envVars
    debug('routes: Parsed environment variables: %O', envVars)
  }
}

/**
 * @param {any} session
 * @param {{ host: any, port: any, username?: any, password?: any, term?: any }} param1
 */
export function setupSshCredentials(session, { host, port, username, password, term }) {
  session.sshCredentials = session.sshCredentials || {}
  session.sshCredentials.host = host
  session.sshCredentials.port = port

  if (username) {
    session.sshCredentials.username = username
  }
  if (password) {
    session.sshCredentials.password = password
  }
  if (term) {
    session.sshCredentials.term = term
  }

  session.usedBasicAuth = true

  const sanitizedCredentials = maskSensitiveData(JSON.parse(JSON.stringify(session.sshCredentials)))
  return sanitizedCredentials
}

/**
 * @param {any} body
 * @param {any} session
 */
export function processSessionRecordingParams(body, session) {
  if (body.allowreplay === 'true' || body.allowreplay === true) {
    session.allowReplay = true
  }
  if (body.mrhsession) {
    session.mrhSession = body.mrhsession
  }
  if (body.readyTimeout) {
    session.readyTimeout = parseInt(body.readyTimeout, 10)
  }
}

/**
 * @param {Error} err
 * @param {{ status: (code:number)=>{ send: (body:any)=>void, json: (b:any)=>void } }} res
 */
export function handleRouteError(err, res) {
  const error = new ConfigError(`Invalid configuration: ${err.message}`)
  handleError(error, res)
}

/**
 * @param {any} req
 * @param {any} res
 * @param {string | null} hostParam
 * @param {import('./types/config').Config} config
 */
function handlePostAuthentication(req, res, hostParam, config) {
  try {
    // Extract credentials from POST body or APM headers
    const username = req.body.username || req.headers['x-apm-username']
    const password = req.body.password || req.headers['x-apm-password']

    if (!username || !password) {
      return res.status(HTTP.UNAUTHORIZED).send('Username and password required')
    }

    let host
    if (hostParam) {
      host = getValidatedHost(hostParam)
    } else {
      if (!config.ssh.host) {
        throw new ConfigError('Host parameter required when default host not configured')
      }
      host = req.body.host || config.ssh.host
    }

    const port = getValidatedPort(req.body.port)
    const sshterm = validateSshTerm(req.body.sshterm || req.body['sshterm'])

    processHeaderParameters(req.body, req.session)
    processEnvironmentVariables(req.body, req.session)

    const sanitizedCredentials = setupSshCredentials(req.session, {
      host,
      port,
      username,
      password,
      term: sshterm,
    })

    // Set authentication method tracking
    req.session.authMethod = 'POST'

    const routePath = hostParam ? `/ssh/host/:host POST` : `/ssh/host/ POST`
    debug(`${routePath} Credentials: `, sanitizedCredentials)

    processSessionRecordingParams(req.body, req.session)
    handleConnection(req, res, { host: host })
  } catch (err) {
    handleRouteError(err, res)
  }
}

/**
 * @param {import('./types/config').Config} config
 */
export function createRoutes(config) {
  const router = express.Router()
  const auth = createAuthMiddleware(config)

  // Scenario 1: No auth required, uses websocket authentication instead
  router.get('/', (req, res) => {
    debug('router.get./: Accessed / route')

    processHeaderParameters(req.query, req.session)
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

    processEnvironmentVariables(req.query, req.session)
    processHeaderParameters(req.query, req.session)

    try {
      if (!config.ssh.host) {
        throw new ConfigError('Host parameter required when default host not configured')
      }

      const { host } = config.ssh
      const port = getValidatedPort(req.query.port)
      const sshterm = validateSshTerm(req.query.sshterm)

      const sanitizedCredentials = setupSshCredentials(req.session, {
        host,
        port,
        term: req.query.sshterm ? sshterm : undefined,
      })
      debug('/ssh/host/ Credentials: ', sanitizedCredentials)

      handleConnection(req, res, { host: host })
    } catch (err) {
      handleRouteError(err, res)
    }
  })

  // Scenario 2: Auth required, uses HTTP Basic Auth
  router.get('/host/:host', auth, (req, res) => {
    debug(`router.get.host: /ssh/host/${req.params.host} route`)

    processEnvironmentVariables(req.query, req.session)
    processHeaderParameters(req.query, req.session)

    try {
      const host = getValidatedHost(req.params.host)
      const port = getValidatedPort(req.query.port)
      const sshterm = validateSshTerm(req.query.sshterm)

      const sanitizedCredentials = setupSshCredentials(req.session, {
        host,
        port,
        term: req.query.sshterm ? sshterm : undefined,
      })
      debug('/ssh/host/ Credentials: ', sanitizedCredentials)

      handleConnection(req, res, { host: host })
    } catch (err) {
      handleRouteError(err, res)
    }
  })

  // POST route for SSO authentication (e.g., BIG-IP APM)
  // This route accepts form-encoded credentials instead of Basic Auth
  router.post('/host/', (req, res) => {
    debug(`router.post.host: /ssh/host/ route`)
    handlePostAuthentication(req, res, null, config)
  })

  // POST route with specific host
  router.post('/host/:host', (req, res) => {
    debug(`router.post.host: /ssh/host/${req.params.host} route`)
    handlePostAuthentication(req, res, req.params.host, config)
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
