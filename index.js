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
var SSH = require('ssh2').Client
var config = require('read-config')(path.join(__dirname, 'config.json'))
var debug = require('debug')
var debugWebSSH2 = debug('WebSSH2')
var util = require('./util')
var SocketUtil = require('./socket')
var session = require('express-session')({
  secret: config.session.secret,
  name: config.session.name,
  resave: true,
  saveUninitialized: false
})
var termCols, termRows, myError
// var LogPrefix
// var dataBuffer = ''

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
app.use(util.basicAuth)

app.disable('x-powered-by')

app.use(express.static(path.join(__dirname, 'public'), expressOptions))

app.get('/ssh/host/:host?', function (req, res, next) {
  res.sendFile(path.join(path.join(__dirname, 'public', 'client.htm')))
  // capture url variables if defined
  config.ssh.host = req.params.host || config.ssh.host
  config.ssh.port = req.query.port || config.ssh.port
  config.header.text = req.query.header || config.header.text
  config.header.background = req.query.headerBackground || config.header.background
  console.log('webssh2 Login: user=' + req.session.username + ' from=' + req.ip + ' host=' + config.ssh.host + ' port=' + config.ssh.port + ' sessionID=' + req.sessionID + ' allowreplay=' + req.headers.allowreplay)
  // LogPrefix = req.session.username + '@' + req.ip + ' ssh://' + config.ssh.host + ':' + config.ssh.port + '/' + req.sessionID
  // console.log('Headers: ' + JSON.stringify(req.headers))
  config.options.allowreplay = req.headers.allowreplay
})

app.use('/style', express.static(path.join(__dirname, 'public')))

app.use('/src', express.static(path.join(__dirname, 'node_modules', 'xterm', 'dist')))

app.use('/addons', express.static(path.join(__dirname, 'node_modules', 'xterm', 'dist', 'addons')))

app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
})

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

// socket.io

io.use(function (socket, next) {
  if (socket.request.res) {
    session(socket.request, socket.request.res, next)
  } else {
    next()
  }
})

io.on('connection', function (socket) {
  // if websocket connection arrives without an express session, kill it
  if (!socket.request.session) {
    socket.disconnect(true)
    return
  }
  var socketutil = new SocketUtil(socket, io)
  var conn = new SSH()
  socket.on('geometry', function (cols, rows) {
    termCols = cols
    termRows = rows
  })

  conn.on('banner', function (d) {
        // need to convert to cr/lf for proper formatting
    d = d.replace(/\r?\n/g, '\r\n')
    socket.emit('data', d.toString('binary'))
  })

  conn.on('ready', function () {
    socket.emit('title', 'ssh://' + config.ssh.host)
    socket.emit('headerBackground', config.header.background)
    socket.emit('header', config.header.text)
    socket.emit('footer', 'ssh://' + socket.request.session.username + '@' + config.ssh.host + ':' + config.ssh.port)
    socket.emit('status', 'SSH CONNECTION ESTABLISHED')
    socket.emit('statusBackground', config.header.background)
    socket.emit('allowreplay', config.options.allowreplay)

    conn.shell({
      term: config.ssh.term,
      cols: termCols,
      rows: termRows
    }, function (err, stream) {
      if (err) {
        socketutil.SSHerror('EXEC ERROR' + err)
        conn.end()
        return
      }
      socket.on('data', function (data) {
        stream.write(data)
        // poc to log commands from client
        // if (data === '\r') {
        //   console.log(LogPrefix + ': ' + dataBuffer)
        //   dataBuffer = ''
        // } else {
        //  dataBuffer = dataBuffer + data
        // }
      })
      socket.on('control', function (controlData) {
        switch (controlData) {
          case 'replayCredentials':
            stream.write(socket.request.session.userpassword + '\n')
                        /* falls through */
          default:
            console.log('controlData: ' + controlData)
        }
      })
      
      socket.on('disconnecting', function (reason) { debugWebSSH2('SOCKET DISCONNECTING: ' + reason) })

      socket.on('disconnect', function (reason) {
        debugWebSSH2('SOCKET DISCONNECT: ' + reason)
        err = { message: reason }
        socketutil.SSHerror ('CLIENT SOCKET DISCONNECT', err)
        conn.end()
      })

      socket.on('error', function (error) { debugWebSSH2('SOCKET ERROR: ' + JSON.stringify(error)) })

      stream.on('data', function (d) { socket.emit('data', d.toString('binary')) })

      stream.on('close', function (code, signal) {
        err = { message: ((code||signal) ? (((code)? 'CODE: ' + code: '') + ((code&&signal)? ' ':'') +  ((signal)? 'SIGNAL: ' + signal : '')) : undefined) }
        socketutil.SSHerror('STREAM CLOSE', err)
        conn.end()
      })

      stream.stderr.on('data', function (data) {
        console.log('STDERR: ' + data)
      })
    })
  })

  conn.on('end', function (err) { socketutil.SSHerror('CONN END BY HOST', err) })
  conn.on('close', function (err) { socketutil.SSHerror('CONN CLOSE', err) })
  conn.on('error', function (err) { socketutil.SSHerror('CONN ERROR', err ) })

  conn.on('keyboard-interactive', function (name, instructions, instructionsLang, prompts, finish) {
    debugWebSSH2('Connection :: keyboard-interactive')
    finish([socket.request.session.userpassword])
  })
  if (socket.request.session.username && socket.request.session.userpassword) {
    conn.connect({
      host: config.ssh.host,
      port: config.ssh.port,
      username: socket.request.session.username,
      password: socket.request.session.userpassword,
      tryKeyboard: true,
      // some cisco routers need the these cipher strings
      algorithms: {
        'cipher': ['aes128-cbc', '3des-cbc', 'aes256-cbc', 'aes128-ctr', 'aes192-ctr', 'aes256-ctr'],
        'hmac': ['hmac-sha1', 'hmac-sha1-96', 'hmac-md5-96']
      },
      debug: debug('ssh2')
    })
  } else {
    console.warn('Attempt to connect without session.username/password defined, potentially previously abandoned client session. disconnecting websocket client.\r\nHandshake information: \r\n  ' + JSON.stringify(socket.handshake))
    socket.emit('statusBackground', 'red')
    socket.emit('status', 'WEBSOCKET ERROR - Reload and try again')
    socket.disconnect(true)
  }
})
