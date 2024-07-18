// server
// /app/routes.js
const express = require('express');
const path = require('path');
const router = express.Router();
const handleConnection = require('./connectionHandler');

// Route for host in URL
router.get('/host/:host', (req, res) => {
  handleConnection(req, res, { host: req.params.host });
});

// Default route
router.get('/', (req, res) => {
  handleConnection(req, res);
});

module.exports = router;