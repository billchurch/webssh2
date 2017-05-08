/*
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch - April 2016
 *
 */
var express = require('express'),
  app = express(),
  cookieParser = require('cookie-parser'),
  server = require('http').Server(app),
  io = require('socket.io')(server),
  path = require('path'),
  basicAuth = require('basic-auth'),
  SSH = require('ssh2').Client,
  readConfig = require('read-config'),
  config = readConfig(path.join(__dirname, 'config.json')),
  myError = ' - ',
  termCols,
  termRows

// function logErrors (err, req, res, next) {
//   console.error(err.stack)
//  next(err)
// }

server.listen({
  host: config.listen.ip,
  port: config.listen.port
}).on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    config.listen.port++
    console.log('Address in use, retrying on port ' + config.listen.port)
    setTimeout(function () {
      server.listen(config.listen.port)
    }, 250)
  }
})

app.use(express.static(path.join(__dirname, 'public'))).use(function (req, res, next) {
  var myAuth = basicAuth(req)
  if (myAuth === undefined) {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH"')
    res.end('Username and password required for web SSH service.')
  } else if (myAuth.name === '') {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH"')
    res.end('Username and password required for web SSH service.')
  } else {
    config.user.name = myAuth.name
    config.user.password = myAuth.pass
    next()
  }
}).use(cookieParser()).get('/ssh/host/:host?', function (req, res) {
  res.sendFile(path.join(path.join(__dirname, 'public', 'client.htm')))
  config.ssh.host = req.params.host
  if (typeof req.query.port !== 'undefined' && req.query.port !== null) {
    config.ssh.port = req.query.port
  }
  if (typeof req.query.header !== 'undefined' && req.query.header !== null) {
    config.header.text = req.query.header
  }
  if (typeof req.query.headerBackground !== 'undefined' && req.query.headerBackground !== null) {
    config.header.background = req.query.headerBackground
  }
  console.log('webssh2 Login: user=' + config.user.name + ' from=' + req.ip + ' host=' + config.ssh.host + ' port=' + config.ssh.port + ' sessionID=' + req.headers.sessionid + ' allowreplay=' + req.headers.allowreplay)
  console.log('Headers: ' + JSON.stringify(req.headers))
  config.options.allowreplay = req.headers.allowreplay
}).use('/style', express.static(path.join(__dirname, 'public'))).use('/src', express.static(path.join(__dirname, 'node_modules', 'xterm', 'dist'))).use('/addons', express.static(path.join(__dirname, 'node_modules', 'xterm', 'dist', 'addons')))

io.on('connection', function (socket) {
  var conn = new SSH()
  socket.on('geometry', function (cols, rows) {
    termCols = cols
    termRows = rows
  })

  conn.on('banner', function (d) {
        // need to convert to cr/lf for proper formatting
    d = d.replace(/\r?\n/g, '\r\n')
    socket.emit('data', d.toString('binary'))
  }).on('ready', function () {
    socket.emit('title', 'ssh://' + config.ssh.host)
    socket.emit('headerBackground', config.header.background)
    socket.emit('header', config.header.text)
    socket.emit('footer', 'ssh://' + config.user.name + '@' + config.ssh.host + ':' + config.ssh.port)
    socket.emit('status', 'SSH CONNECTION ESTABLISHED')
    socket.emit('statusBackground', 'green')
    socket.emit('allowreplay', config.options.allowreplay)

    conn.shell({
      term: config.ssh.term,
      cols: termCols,
      rows: termRows
    }, function (err, stream) {
      if (err) {
        console.log(err.message)
        myError = myError + err.message
        return socket.emit('status', 'SSH EXEC ERROR: ' + err.message).emit('statusBackground', 'red')
      }
      socket.on('data', function (data) {
        stream.write(data)
      })
      socket.on('control', function (controlData) {
        switch (controlData) {
          case 'replayCredentials':
            stream.write(config.user.password + '\n')
                        /* falls through */
          default:
            console.log('controlData: ' + controlData)
        }
      })

      stream.on('data', function (d) {
        socket.emit('data', d.toString('binary'))
      }).on('close', function (code, signal) {
        console.log('Stream :: close :: code: ' + code + ', signal: ' + signal)
        conn.end()
        socket.disconnect()
      }).stderr.on('data', function (data) {
        console.log('STDERR: ' + data)
      })
    })
  }).on('end', function () {
    socket.emit('status', 'SSH CONNECTION CLOSED BY HOST' + myError)
    socket.emit('statusBackground', 'red')
    socket.disconnect()
  }).on('close', function () {
    socket.emit('status', 'SSH CONNECTION CLOSE' + myError)
    socket.emit('statusBackground', 'red')
    socket.disconnect()
  }).on('error', function (err) {
    myError = myError + err
    socket.emit('status', 'SSH CONNECTION ERROR' + myError)
    socket.emit('statusBackground', 'red')
    console.log('on.error' + myError)
  }).on('keyboard-interactive', function (name, instructions, instructionsLang, prompts, finish) {
    console.log('Connection :: keyboard-interactive')
    finish([config.user.password])
  }).connect({
    host: config.ssh.host,
    port: config.ssh.port,
    username: config.user.name,
    password: config.user.password,
    tryKeyboard: true,
        // some cisco routers need the these cipher strings
    algorithms: {
      'cipher': ['aes128-cbc', '3des-cbc', 'aes256-cbc'],
      'hmac': ['hmac-sha1', 'hmac-sha1-96', 'hmac-md5-96']
    }
  })
})
