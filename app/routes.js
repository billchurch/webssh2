// server
// /app/routes.js
const createDebug = require("debug")

const debug = createDebug("webssh2:routes")
const express = require("express")

const router = express.Router()
const basicAuth = require("basic-auth")
const maskObject = require("jsmasker")
const validator = require("validator")
const {
  getValidatedHost,
  getValidatedPort,
  validateSshTerm
} = require("./utils")
const handleConnection = require("./connectionHandler")

// eslint-disable-next-line consistent-return
function auth(req, res, next) {
  debug("auth: Basic Auth")
  const credentials = basicAuth(req)
  if (!credentials) {
    res.setHeader("WWW-Authenticate", 'Basic realm="WebSSH2"')
    return res.status(401).send("Authentication required.")
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
router.get("/", function(req, res) {
  debug("router.get./: Accessed / route")
  handleConnection(req, res)
})

// Scenario 2: Auth required, uses HTTP Basic Auth
// Scenario 2: Auth required, uses HTTP Basic Auth
router.get("/host/:host", auth, function(req, res) {
  debug(`router.get.host: /ssh/host/${req.params.host} route`)

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
  const sanitizedCredentials = maskObject(
    JSON.parse(JSON.stringify(req.session.sshCredentials))
  )
  debug("/ssh/host/ Credentials: ", sanitizedCredentials)

  handleConnection(req, res, { host: host })
})

// Clear credentials route
router.get("/clear-credentials", function(req, res) {
  req.session.sshCredentials = null
  res.status(200).send("Credentials cleared.")
})

router.get("/force-reconnect", function(req, res) {
  req.session.sshCredentials = null
  res.status(401).send("Authentication required.")
})

module.exports = router
