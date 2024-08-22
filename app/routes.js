// server
// app/routes.js

const express = require("express")
const basicAuth = require("basic-auth")
const validator = require("validator")
const {
  getValidatedHost,
  getValidatedPort,
  maskSensitiveData,
  validateSshTerm
} = require("./utils")
const handleConnection = require("./connectionHandler")
const { createNamespacedDebug } = require("./logger")
const { ConfigError, handleError } = require("./errors")
const { HTTP } = require("./constants")

const debug = createNamespacedDebug("routes")
const router = express.Router()

// eslint-disable-next-line consistent-return
function auth(req, res, next) {
  debug("auth: Basic Auth")
  const credentials = basicAuth(req)
  if (!credentials) {
    res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
    return res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
  }
  // Validate and sanitize credentials
  req.session.sshCredentials = {
    username: validator.escape(credentials.name),
    password: credentials.pass // We don't sanitize the password as it might contain special characters
  }
  req.session.usedBasicAuth = true // Set this flag when Basic Auth is used
  next()
}

// Scenario 1: No auth required, uses websocket authentication instead
router.get("/", (req, res) => {
  debug("router.get./: Accessed / route")
  handleConnection(req, res)
})

// Scenario 2: Auth required, uses HTTP Basic Auth
router.get("/host/:host", auth, (req, res) => {
  debug(`router.get.host: /ssh/host/${req.params.host} route`)

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

module.exports = router
