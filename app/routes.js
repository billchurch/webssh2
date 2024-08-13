// server
// /app/routes.js
const createDebug = require('debug')
const debug = createDebug('webssh2:routes')
const express = require('express');
const router = express.Router();
const handleConnection = require('./connectionHandler');
const basicAuth = require('basic-auth');

function auth(req, res, next) {
  debug('Authenticating user with HTTP Basic Auth');
  var credentials = basicAuth(req);
  if (!credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH2"');
    return res.status(401).send('Authentication required.');
  }
  // Store credentials in session
  req.session.sshCredentials = credentials;
  next();
}

// Scenario 1: No auth required, uses websocket authentication instead
router.get('/', function(req, res) {
  debug('Accessed /ssh route');
  handleConnection(req, res);
});

// Scenario 2: Auth required, uses HTTP Basic Auth
router.get('/host/:host', auth, function(req, res) {
  debug(`Accessed /ssh/host/${req.params.host} route`);
  handleConnection(req, res, { host: req.params.host });
});

module.exports = router;