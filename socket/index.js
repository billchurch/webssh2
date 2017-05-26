// private
var debug = require('debug')
var debugWebSSH2 = require('debug')('WebSSH2')
var SSH = require('ssh2').Client
var termCols, termRows

// public
module.exports = function (socket) {
  function SSHerror (myFunc, err) {
    socket.request.session.error = (socket.request.session.error) || ((err) ? err.message : undefined)
    var theError = (socket.request.session.error) ? ': ' + socket.request.session.error : ''
    // log unsuccessful login attempt
    if (err && (err.level === 'client-authentication')) {
      console.log('webssh2 ' + 'error: Authentication failure'.red.bold +
      ' user=' + socket.request.session.username.yellow.bold.underline +
      ' from=' + socket.handshake.address.yellow.bold.underline)
    }
    switch (myFunc) {
      case 'STREAM CLOSE':
        debugWebSSH2('SSH ' + myFunc + theError.red)
        socket.emit('ssherror', 'SSH ' + myFunc + theError)
        socket.disconnect(true)
        break
      default:
        debugWebSSH2('SSHerror: default'.red)
        debugWebSSH2('SSH ' + myFunc + theError)
        socket.emit('ssherror', 'SSH ' + myFunc + theError)
        socket.disconnect(true)
    }
  }

  // if websocket connection arrives without an express session, kill it
  if (!socket.request.session) {
    socket.emit('401 UNAUTHORIZED')
    debugWebSSH2('SOCKET: No Express Session / REJECTED')
    socket.disconnect(true)
    return
  }
  var conn = new SSH()
  socket.on('geometry', function (cols, rows) {
    termCols = cols
    termRows = rows
  })
  console.log('webssh2 ' + 'IO ON:'.cyan.bold + ' user=' + socket.request.session.username + ' from=' + socket.handshake.address + ' host=' + socket.request.session.ssh.host + ' port=' + socket.request.session.ssh.port + ' sessionID=' + socket.request.sessionID + '/' + socket.id + ' allowreplay=' + socket.request.session.ssh.allowreplay + ' term=' + socket.request.session.ssh.term)
  conn.on('banner', function (d) {
        // need to convert to cr/lf for proper formatting
    d = d.replace(/\r?\n/g, '\r\n')
    socket.emit('data', d.toString('binary'))
  })

  conn.on('ready', function () {
    console.log('webssh2 Login: user=' + socket.request.session.username + ' from=' + socket.handshake.address + ' host=' + socket.request.session.ssh.host + ' port=' + socket.request.session.ssh.port + ' sessionID=' + socket.request.sessionID + '/' + socket.id + ' allowreplay=' + socket.request.session.ssh.allowreplay + ' term=' + socket.request.session.ssh.term)
    socket.emit('title', 'ssh://' + socket.request.session.ssh.host)
    socket.emit('headerBackground', socket.request.session.ssh.header.background)
    socket.emit('header', socket.request.session.ssh.header.name)
    socket.emit('footer', 'ssh://' + socket.request.session.username + '@' + socket.request.session.ssh.host + ':' + socket.request.session.ssh.port)
    socket.emit('status', 'SSH CONNECTION ESTABLISHED')
    socket.emit('statusBackground', socket.request.session.ssh.header.background)
    socket.emit('allowreplay', socket.request.session.ssh.allowreplay)

    conn.shell({
      term: socket.request.session.ssh.term,
      cols: termCols,
      rows: termRows
    }, function (err, stream) {
      if (err) {
        SSHerror('EXEC ERROR' + err)
        conn.end()
        return
      }
      // poc to log commands from client
      // var dataBuffer
      socket.on('data', function (data) {
        stream.write(data)
        // poc to log commands from client
        // if (data === '\r') {
        //   console.log(socket.request.session.id + '/' + socket.id + ' command: ' + socket.request.session.ssh.host + ': ' + dataBuffer)
        //   dataBuffer = undefined
        // } else {
        //   dataBuffer = (dataBuffer) ? dataBuffer + data : data
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
        SSHerror('CLIENT SOCKET DISCONNECT', err)
        conn.end()
      })

      socket.on('error', function (error) { debugWebSSH2('SOCKET ERROR: ' + JSON.stringify(error)) })

      stream.on('data', function (d) { socket.emit('data', d.toString('binary')) })

      stream.on('close', function (code, signal) {
        err = { message: ((code || signal) ? (((code) ? 'CODE: ' + code : '') + ((code && signal) ? ' ' : '') + ((signal) ? 'SIGNAL: ' + signal : '')) : undefined) }
        SSHerror('STREAM CLOSE', err)
        conn.end()
      })

      stream.stderr.on('data', function (data) {
        console.log('STDERR: ' + data)
      })
    })
  })

  conn.on('end', function (err) { SSHerror('CONN END BY HOST', err) })
  conn.on('close', function (err) { SSHerror('CONN CLOSE', err) })
  conn.on('error', function (err) { SSHerror('CONN ERROR', err) })

  conn.on('keyboard-interactive', function (name, instructions, instructionsLang, prompts, finish) {
    debugWebSSH2('conn.on(\'keyboard-interactive\')')
    finish([socket.request.session.userpassword])
  })
  if (socket.request.session.username && socket.request.session.userpassword) {
    conn.connect({
      host: socket.request.session.ssh.host,
      port: socket.request.session.ssh.port,
      username: socket.request.session.username,
      password: socket.request.session.userpassword,
      tryKeyboard: true,
      // some cisco routers need the these cipher strings
      algorithms: socket.request.session.ssh.algorithms,
      debug: debug('ssh2')
    })
  } else {
    console.warn('Attempt to connect without session.username/password defined, potentially previously abandoned client session. disconnecting websocket client.\r\nHandshake information: \r\n  ' + JSON.stringify(socket.handshake))
    socket.emit('statusBackground', 'red')
    socket.emit('status', 'WEBSOCKET ERROR - Reload and try again')
    socket.disconnect(true)
  }
}
