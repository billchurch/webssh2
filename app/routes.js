// server
// /app/routes.js
const express = require('express');
const router = express.Router();
const handleConnection = require('./connectionHandler');
const basicAuth = require('basic-auth');

function auth(req, res, next) {
  var credentials = basicAuth(req);
  if (!credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH2"');
    return res.status(401).send('Authentication required.');
  }
  // Store credentials in session
  req.session.sshCredentials = credentials;
  next();
}

// Scenario 1: No auth required
router.get('/', function(req, res) {
  handleConnection(req, res);
});

// Scenario 2: Auth required
router.get('/host/:host', auth, function(req, res) {
  handleConnection(req, res, { host: req.params.host });
});

module.exports = router;