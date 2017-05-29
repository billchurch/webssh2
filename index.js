/*
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch/WebSSH2 - May 2017
 *
 */
var express = require('express')
var app = express()
var server = require('http').Server(app)
var io = require('socket.io')(server)
var path = require('path')
var config = require('read-config')(path.join(__dirname, 'config.json'))
var myutil = require('./util')
var socket = require('./socket/index.js')
var validator = require('validator')
var session = require('express-session')({
  secret: config.session.secret,
  name: config.session.name,
  resave: true,
  saveUninitialized: false,
  unset: 'destroy'
})

// express
var expressOptions = {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html'],
  index: false,
  maxAge: '1s',
  redirect: false,
  setHeaders: function (res, path, stat) {
    res.set('x-timestamp', Date.now())
  }
}

app.use(session)
app.use(myutil.basicAuth)

app.disable('x-powered-by')

app.get('/ssh/host/:host?', function (req, res, next) {
  res.sendFile(path.join(path.join(__dirname, 'public', (config.useminified) ? 'client-min.htm' : 'client-full.htm')))
  // capture and assign variables
  req.session.ssh = {
    host: (validator.isIP(req.params.host + '') && req.params.host) || (validator.isFQDN(req.params.host) && req.params.host) || (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.params.host) && req.params.host) || config.ssh.host,
    port: (validator.isInt(req.query.port + '', {min: 1, max: 65535}) && req.query.port) || config.ssh.port,
    header: {
      name: req.query.header || config.header.text,
      background: req.query.headerBackground || config.header.background
    },
    algorithms: config.algorithms,
    term: (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.query.sshterm) && req.query.sshterm) || config.ssh.term,
    allowreplay: validator.isBoolean(req.headers.allowreplay + '') || false
  }
  req.session.ssh.header.name && validator.escape(req.session.ssh.header.name)
  req.session.ssh.header.background && validator.escape(req.session.ssh.header.background)
})

// static files
app.use(express.static(path.join(__dirname, 'public'), expressOptions))

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
  (socket.request.res) ? session(socket.request, socket.request.res, next) : next()
})

// bring up socket
io.on('connection', socket)

// server
server.listen({
  host: config.listen.ip,
  port: config.listen.port
})

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    config.listen.port++
    console.warn('Address in use, retrying on port ' + config.listen.port)
    setTimeout(function () {
      server.listen(config.listen.port)
    }, 250)
  } else {
    console.log('server.listen ERROR: ' + err.code)
  }
})
