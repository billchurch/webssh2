// server
// app/routes.js

const express = require("express")

const {
  getValidatedHost,
  getValidatedPort,
  maskSensitiveData,
  validateSshTerm
} = require("./utils")
const handleConnection = require("./connectionHandler")
const { createNamespacedDebug } = require("./logger")
const { createAuthMiddleware } = require("./middleware")
const { ConfigError, handleError } = require("./errors")
const { HTTP } = require("./constants")
const { parseEnvVars } = require("./utils")

const debug = createNamespacedDebug("routes")

module.exports = function(config) {
  const router = express.Router()
  const auth = createAuthMiddleware(config)

  // Scenario 1: No auth required, uses websocket authentication instead
  router.get("/", (req, res) => {
    debug("router.get./: Accessed / route")
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
  router.get("/host/", auth, (req, res) => {
    debug(`router.get.host: /ssh/host/ route`)
    const envVars = parseEnvVars(req.query.env)
    if (envVars) {
      req.session.envVars = envVars
      debug("routes: Parsed environment variables: %O", envVars)
    }

    try {
      if (!config.ssh.host) {
        throw new ConfigError(
          "Host parameter required when default host not configured"
        )
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
      debug("/ssh/host/ Credentials: ", sanitizedCredentials)

      handleConnection(req, res, { host: host })
    } catch (err) {
      const error = new ConfigError(`Invalid configuration: ${err.message}`)
      handleError(error, res)
    }
  })

  // Scenario 2: Auth required, uses HTTP Basic Auth
  router.get("/host/:host?", auth, (req, res) => {
    debug(`router.get.host: /ssh/host/${req.params.host} route`)
    const envVars = parseEnvVars(req.query.env)
    if (envVars) {
      req.session.envVars = envVars
      debug("routes: Parsed environment variables: %O", envVars)
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
      debug("/ssh/host/ Credentials: ", sanitizedCredentials)

      handleConnection(req, res, { host: host })
    } catch (err) {
      const error = new ConfigError(`Invalid configuration: ${err.message}`)
      handleError(error, res)
    }
  })

  // Clear credentials route
  router.get("/clear-credentials", (req, res) => {
    req.session.sshCredentials = null
    res.status(HTTP.OK).send(HTTP.CREDENTIALS_CLEARED)
  })

  router.get("/force-reconnect", (req, res) => {
    req.session.sshCredentials = null
    res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
  })

  return router
}
