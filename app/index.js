'use strict'
/* jshint esversion: 6, asi: true, node: true */
/*
 * index.js
 *
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch/WebSSH2 - May 2017
 *
 */
var path = require('path')
var express = require('express')
var app = express()
var compression = require('compression')
var nodeRoot = path.dirname(require.main.filename)
var expressOptions = require('./server/expressOptions')

// static files
var publicPath = path.join(nodeRoot, 'client', 'public')
app.use(express.static(publicPath, expressOptions))

// express
app.use(compression({ level: 9 }))
var server = require('http').Server(app)
var io = require('socket.io')(server, { serveClient: false })

app.disable('x-powered-by')

var config = require('./server/app').config
require('./server/app').mySSH(app,io.of("/ssh"))

server.listen({ host: config.listen.ip, port: config.listen.port
})

console.log('WebSSH2 service listening on ' + config.listen.ip + ':' + config.listen.port)

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    config.listen.port++
    console.warn('WebSSH2 Address in use, retrying on port ' + config.listen.port)
    setTimeout(function () {
      server.listen(config.listen.port)
    }, 250)
  } else {
    console.log('WebSSH2 server.listen ERROR: ' + err.code)
  }
})
