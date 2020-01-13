'use strict'
/* jshint esversion: 6, asi: true, node: true */
// app.js

var path = require('path')
var nodeRoot = path.dirname(require.main.filename)
var publicPath = path.join(nodeRoot, 'client', 'public')
var config = require('./config')
var express = require('express')
var logger = require('morgan')
var app = express()
var compression = require('compression')
var server = require('http').Server(app)
var myutil = require('./util')
var io = require('socket.io')(server, { serveClient: false })
var socket = require('./socket')
var expressOptions = require('./expressOptions')
var session = require('express-session')({
  secret: config.session.secret,
  name: config.session.name,
  resave: true,
  saveUninitialized: false,
  unset: 'destroy'
})

// express
app.use(compression({ level: 9 }))
app.use(session)
app.use(myutil.basicAuth)
if (config.accesslog) app.use(logger('common'))
app.disable('x-powered-by')

// static files
app.use(express.static(publicPath, expressOptions))

app.get('/reauth', function (req, res, next) {
  var r = req.headers.referer || '/'
  res.status(401).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=' + r + '"></head><body bgcolor="#000"></body></html>')
})

// eslint-disable-next-line complexity
app.get('/ssh/host/:host?', function (req, res, next) {
  res.sendFile(path.join(path.join(publicPath, 'client.htm')))
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

module.exports = { server: server, config: config }
