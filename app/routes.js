// server
// /app/routes.js
const createDebug = require("debug")
const debug = createDebug("webssh2:routes")
const express = require("express")
const router = express.Router()
const handleConnection = require("./connectionHandler")
const basicAuth = require("basic-auth")
const { sanitizeObject } = require("./utils")
const validator = require("validator")

function auth(req, res, next) {
  debug("Authenticating user with HTTP Basic Auth")
  var credentials = basicAuth(req)
  if (!credentials) {
    res.setHeader("WWW-Authenticate", 'Basic realm="WebSSH2"')
    return res.status(401).send("Authentication required.")
  }
  // Validate and sanitize credentials
  req.session.sshCredentials = {
    username: validator.escape(credentials.name),
    password: credentials.pass // We don't sanitize the password as it might contain special characters
  }
  next()
}

// Scenario 1: No auth required, uses websocket authentication instead
router.get("/", function (req, res) {
  debug("Accessed / route")
  handleConnection(req, res)
})

// Scenario 2: Auth required, uses HTTP Basic Auth
router.get("/host/:host", auth, function (req, res) {
  debug(`Accessed /ssh/host/${req.params.host} route`)

  // Validate and sanitize host parameter
  const host = validator.isIP(req.params.host)
    ? req.params.host
    : validator.escape(req.params.host)

  // Validate and sanitize port parameter if it exists
  const port = req.query.port
    ? validator.isPort(req.query.port)
      ? parseInt(req.query.port, 10)
      : 22
    : 22 // Default to 22 if port is not provided

  // Validate and sanitize sshTerm parameter if it exists
  const sshTerm = req.query.sshTerm
    ? validateSshTerm(req.query.sshTerm)
      ? req.query.sshTerm
      : null
    : null // Default to 'xterm-color' if sshTerm is not provided

  req.session.sshCredentials = req.session.sshCredentials || {}
  req.session.sshCredentials.host = host
  req.session.sshCredentials.port = port
  if (req.query.sshTerm) {
    req.session.sshCredentials.term = sshTerm
  }

  // Sanitize and log the sshCredentials object
  const sanitizedCredentials = sanitizeObject(
    JSON.parse(JSON.stringify(req.session.sshCredentials))
  )
  debug("/ssh/host/ Credentials: ", sanitizedCredentials)

  handleConnection(req, res, { host: host })
})

// Clear credentials route
router.post("/clear-credentials", function (req, res) {
  req.session.sshCredentials = null
  res.status(200).send("Credentials cleared.")
})

router.post("/force-reconnect", function (req, res) {
  req.session.sshCredentials = null
  res.status(401).send("Authentication required.")
})

/**
 * Validates the SSH terminal name using validator functions.
 * Allows alphanumeric characters, hyphens, and periods.
 * @param {string} term - The terminal name to validate
 * @returns {boolean} True if the terminal name is valid, false otherwise
 */
function validateSshTerm(term) {
  return (
    validator.isLength(term, { min: 1, max: 30 }) &&
    validator.matches(term, /^[a-zA-Z0-9.-]+$/)
  )
}

module.exports = router
