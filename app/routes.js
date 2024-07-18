// server
// /app/routes.js
var express = require('express');
var router = express.Router();
var handleConnection = require('./connectionHandler');
var basicAuth = require('basic-auth');

function auth(req, res, next) {
  var credentials = basicAuth(req);
  if (!credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH2"');
    return res.status(401).send('Authentication required.');
  }
  req.sshCredentials = credentials;
  next();
}

// Scenario 1: No auth required
router.get('/', function(req, res) {
  handleConnection(req, res);
});

// Scenario 2: Auth required
router.get('/host/:host', auth, function(req, res) {
  handleConnection(req, res, { 
    host: req.params.host,
    username: req.sshCredentials.name,
    password: req.sshCredentials.pass
  });
});

module.exports = router;