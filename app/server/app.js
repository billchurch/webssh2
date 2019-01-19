'use strict'
/* jshint esversion: 6, asi: true, node: true */
// app.js

var path = require('path')
// configPath = path.join(__dirname, 'config.json')
var nodeRoot = path.dirname(require.main.filename)
var configPath = path.join(nodeRoot, 'config.json')
var publicPath = path.join(nodeRoot, 'client', 'public')
console.log('WebSSH2 service reading config from: ' + configPath)
var config = require('read-config')(configPath),
fs = require('fs'),
os = require('os');
var logger = require('morgan')
var session = require('express-session')({
  secret: config.session.secret,
  name: config.session.name,
  resave: true,
  saveUninitialized: false,
  unset: 'destroy'
})


var myutil = require('./util')
var validator = require('validator')

var socket = require('./socket')



function mySSH(app, io)
{
  app.use(session)
  app.get('/reauth', function (req, res, next) {
    var r = req.headers.referer || '/'
    res.status(401).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=' + r + '"></head><body bgcolor="#000"></body></html>')
  })
  
  if (config.accesslog) app.use(logger('common'))
  app.use(myutil.basicAuth)
  
// test:
// http://127.0.0.1:2222/ssh/host/165.149.12.16?host=165.149.12.16&user=root&port=54321
app.get('/ssh/host/:host?', function (req, res, next) {
  var szHost = req.params && req.params.host || null;
  if(req.query)
  {
    req.params = req.query;
    req.params.host = szHost || req.params.host;
  }
  // console.log(req.params);
  res.sendFile(path.join(path.join(publicPath, 'client.htm')))
  if(req.params)
  {
      if(req.params.user)
          req.session.username = req.params.user;
      if(req.params.pass)
          req.session.userpassword = req.params.pass;
  }
  if(!req.params || !req.params.host)return;
  var szKey = '';
  if(!szKey && fs.existsSync(os.userInfo().homedir + config.privateKey))
  {
    szKey = fs.readFileSync(os.userInfo().homedir + config.privateKey).toString('utf8');
    // console.log(szKey);
  }

  // capture, assign, and validated variables
  req.session.ssh = {
    privateKey: szKey,
    host: (validator.isIP(req.params.host + '') && req.params.host) ||
      (validator.isFQDN(req.params.host) && req.params.host) ||
      (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.params.host) &&
      req.params.host) || config.ssh.host,
    port: (validator.isInt(req.params.port + '', { min: 1, max: 65535 }) &&
      req.params.port) || config.ssh.port,
    header: {
      name: req.query.header || config.header.text,
      background: req.query.headerBackground || config.header.background
    },
    algorithms: config.algorithms,
    keepaliveInterval: config.ssh.keepaliveInterval,
    keepaliveCountMax: config.ssh.keepaliveCountMax,
    term: (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.query.sshterm) &&
      req.query.sshterm) || config.ssh.term,
    terminal: {
      cursorBlink: (validator.isBoolean(req.query.cursorBlink + '') ? myutil.parseBool(req.query.cursorBlink) : config.terminal.cursorBlink),
      scrollback: (validator.isInt(req.query.scrollback + '', { min: 1, max: 200000 }) && req.query.scrollback) ? req.query.scrollback : config.terminal.scrollback,
      tabStopWidth: (validator.isInt(req.query.tabStopWidth + '', { min: 1, max: 100 }) && req.query.tabStopWidth) ? req.query.tabStopWidth : config.terminal.tabStopWidth,
      bellStyle: ((req.query.bellStyle) && (['sound', 'none'].indexOf(req.query.bellStyle) > -1)) ? req.query.bellStyle : config.terminal.bellStyle
    },
    allowreplay: config.options.challengeButton || (validator.isBoolean(req.headers.allowreplay + '') ? myutil.parseBool(req.headers.allowreplay) : false),
    allowreauth: config.options.allowreauth || false,
    mrhsession: ((validator.isAlphanumeric(req.headers.mrhsession + '') && req.headers.mrhsession) ? req.headers.mrhsession : 'none'),
    serverlog: {
      client: config.serverlog.client || false,
      server: config.serverlog.server || false
    },
    readyTimeout: (validator.isInt(req.query.readyTimeout + '', { min: 1, max: 300000 }) &&
      req.query.readyTimeout) || config.ssh.readyTimeout
  }
  if (req.session.ssh.header.name) validator.escape(req.session.ssh.header.name)
  if (req.session.ssh.header.background) validator.escape(req.session.ssh.header.background)
})

// express error handling
app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
})

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

// socket.io
// expose express session with socket.request.session
io.use(function (socket, next) {
  (socket.request.res) ? session(socket.request, socket.request.res, next)
    : next(next)
})

// bring up socket
io.on('connection', socket)
}
module.exports = { config: config,mySSH: mySSH }
