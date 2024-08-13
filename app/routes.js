// server
// /app/routes.js
const createDebug = require('debug')
const debug = createDebug('webssh2:routes')
const express = require('express')
const router = express.Router()
const handleConnection = require('./connectionHandler')
const basicAuth = require('basic-auth')
const { sanitizeObject } = require('./utils')

function auth(req, res, next) {
  debug('Authenticating user with HTTP Basic Auth')
  var credentials = basicAuth(req)
  if (!credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH2"')
    return res.status(401).send('Authentication required.')
  }
  // Store credentials in session
  req.session.sshCredentials = {
    username: credentials.name,
    password: credentials.pass
  }
  next()
}

// Scenario 1: No auth required, uses websocket authentication instead
router.get('/', function (req, res) {
  debug('Accessed / route')
  handleConnection(req, res)
})

// Scenario 2: Auth required, uses HTTP Basic Auth
router.get('/host/:host', auth, function (req, res) {
  debug(`Accessed /ssh/host/${req.params.host} route`)
  const { host, port = 22 } = req.params;
  req.session.sshCredentials.host = host
  req.session.sshCredentials.port = port

  // Sanitize the sshCredentials object before logging
  const sanitizedCredentials = sanitizeObject(
    JSON.parse(JSON.stringify(req.session.sshCredentials))
  );

  // Log the sanitized credentials
  debug('/ssh//host/ Credentials: ', sanitizedCredentials);

  handleConnection(req, res, { host: req.params.host })
})

// Clear credentials route
router.post('/clear-credentials', function (req, res) {
  req.session.sshCredentials = null
  res.status(200).send('Credentials cleared.')
})

router.post("/force-reconnect", function (req, res) {
  req.session.sshCredentials = null;
  res.status(401).send("Authentication required.");
});

module.exports = router
