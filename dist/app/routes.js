// server
// app/routes.ts
import express, { Router } from 'express'
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
function processHeaderParameters(source, session) {
  const isGet = typeof source.header !== 'undefined'
  const headerKey = isGet ? 'header' : 'header.name'
  const backgroundKey = isGet ? 'headerBackground' : 'header.background'
  const styleKey = isGet ? 'headerStyle' : 'header.color'
  const headerValue = source[headerKey]
  const backgroundValue = source[backgroundKey]
  const styleValue = source[styleKey]
  if (headerValue || backgroundValue || styleValue) {
    session.headerOverride = {}
    if (headerValue) {
      session.headerOverride.text = headerValue
      debug('Header text from %s: %s', isGet ? 'URL parameter' : 'POST', headerValue)
    }
    if (backgroundValue) {
      session.headerOverride.background = backgroundValue
      debug('Header background from %s: %s', isGet ? 'URL parameter' : 'POST', backgroundValue)
    }
    if (styleValue) {
      if (isGet) {
        session.headerOverride.style = styleValue
        debug('Header style from URL parameter: %s', styleValue)
      } else {
        session.headerOverride.style = `color: ${styleValue}`
        debug('Header color from POST: %s', styleValue)
      }
    }
    debug('Header override set in session: %O', session.headerOverride)
  }
}
function processEnvironmentVariables(source, session) {
  if (source.env) {
    const envVars = parseEnvVars(source.env)
    if (envVars) {
      session.envVars = envVars
      debug('routes: Parsed environment variables: %O', envVars)
    }
  }
}
function setupSshCredentials(session, { host, port, username, password, term }) {
  session.sshCredentials = session.sshCredentials || {
    host: '',
    port: 22,
    username: '',
  }
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
function processSessionRecordingParams(body, session) {
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
function handleRouteError(err, res) {
  const error = new ConfigError(`Invalid configuration: ${err.message}`)
  handleError(error, res)
}
function handlePostAuthentication(req, res, hostParam, config) {
  try {
    // Extract credentials from POST body or APM headers
    const username = req.body.username || req.headers['x-apm-username']
    const password = req.body.password || req.headers['x-apm-password']
    if (!username || !password) {
      res.status(HTTP.UNAUTHORIZED).send('Username and password required')
      return
    }
    let host
    if (hostParam) {
      host = getValidatedHost(hostParam)
    } else {
      if (!config.ssh.host) {
        throw new ConfigError('Host parameter required when default host not configured')
      }
      host = req.body['host'] || config.ssh.host || ''
    }
    const port = getValidatedPort(req.body['port'])
    const sshterm = validateSshTerm(req.body['sshterm'])
    processHeaderParameters(req.body, req.session)
    processEnvironmentVariables(req.body, req.session)
    const sanitizedCredentials = setupSshCredentials(req.session, {
      host,
      port,
      username,
      password,
      term: sshterm || undefined,
    })
    // Set authentication method tracking
    req.session.authMethod = 'POST'
    const routePath = hostParam ? `/ssh/host/:host POST` : `/ssh/host/ POST`
    debug(`${routePath} Credentials: `, sanitizedCredentials)
    processSessionRecordingParams(req.body, req.session)
    handleConnection(req, res)
  } catch (err) {
    handleRouteError(err, res)
  }
}
export function createRoutes(config) {
  const router = express.Router()
  const auth = createAuthMiddleware({
    user: config.user,
    session: {
      secret: config.session?.secret || 'webssh2-secret',
      name: 'webssh2-session',
    },
    sso: {
      enabled: false,
    },
  })
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
   * @param req - The Express request object
   * @param res - The Express response object
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
      const port = getValidatedPort(req.query['port'])
      const sshterm = validateSshTerm(req.query['sshterm'])
      const sanitizedCredentials = setupSshCredentials(req.session, {
        host,
        port,
        term: req.query['sshterm'] ? sshterm || undefined : undefined,
      })
      debug('/ssh/host/ Credentials: ', sanitizedCredentials)
      handleConnection(req, res)
    } catch (err) {
      handleRouteError(err, res)
    }
  })
  // Scenario 2: Auth required, uses HTTP Basic Auth
  router.get('/host/:host', auth, (req, res) => {
    debug(`router.get.host: /ssh/host/${req.params['host']} route`)
    processEnvironmentVariables(req.query, req.session)
    processHeaderParameters(req.query, req.session)
    try {
      const host = getValidatedHost(req.params['host'])
      const port = getValidatedPort(req.query['port'])
      const sshterm = validateSshTerm(req.query['sshterm'])
      const sanitizedCredentials = setupSshCredentials(req.session, {
        host,
        port,
        term: req.query['sshterm'] ? sshterm || undefined : undefined,
      })
      debug('/ssh/host/ Credentials: ', sanitizedCredentials)
      handleConnection(req, res)
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
    debug(`router.post.host: /ssh/host/${req.params['host']} route`)
    handlePostAuthentication(req, res, req.params['host'] || null, config)
  })
  // Clear credentials route
  router.get('/clear-credentials', (req, res) => {
    req.session.sshCredentials = undefined
    res.status(HTTP.OK).send('Credentials cleared')
  })
  router.get('/force-reconnect', (req, res) => {
    req.session.sshCredentials = undefined
    res.status(HTTP.UNAUTHORIZED).send('Authentication required')
  })
  return router
}
//# sourceMappingURL=routes.js.map
