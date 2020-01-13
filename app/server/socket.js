/* eslint-disable complexity */
'use strict'
/* jshint esversion: 6, asi: true, node: true */
// socket.js

// private
var config = require('./config')
var validator = require('validator')
var debug = require('debug')
var myutil = require('./util')
var debugWebSSH2 = require('debug')('WebSSH2')
var SSH = require('ssh2').Client
var CIDRMatcher = require('cidr-matcher')
// var fs = require('fs')
// var hostkeys = JSON.parse(fs.readFileSync('./hostkeyhashes.json', 'utf8'))
var termCols, termRows
var menuData = '<a id="logBtn"><i class="fas fa-clipboard fa-fw"></i> Start Log</a>' +
  '<a id="downloadLogBtn"><i class="fas fa-download fa-fw"></i> Download Log</a>'

// return a subset of keys from an object if they exist
function pick (obj, keys) {
  return keys.reduce((acc, key) => {
    if (obj[key]) {
      acc[key] = obj[key]
    }
    return acc
  }, {})
}

const baseSocketConfig = {
  host: config.ssh.host,
  port: config.ssh.port,
  localAddress: config.ssh.localAddress,
  localPort: config.ssh.localPort,
  term: config.ssh.term,
  readyTimeout: config.ssh.readyTimeout,
  algorithms: config.algorithms,
  keepaliveInterval: config.ssh.keepaliveInterval,
  keepaliveCountMax: config.ssh.keepaliveCountMax,
  allowedSubnets: config.ssh.allowedSubnets || [],
  header: {
    name: config.header.text,
    background: config.header.background
  },
  terminal: {
    cursorBlink: config.terminal.cursorBlink,
    scrollBack: config.terminal.scrollback,
    tabStopWidth: config.terminal.tabStopWidth,
    bellStyle: config.terminal.bellStyle
  },
  serverlog: {
    client: config.serverlog.client || false,
    server: config.serverlog.server || false
  }
}

function getValidatedRequestConfig (queryParams) {
  const processedParams = {}
  const validators = {
    host: (host) => validator.isIP(host + '') || validator.isFQDN(host) || /^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(host),
    port: (port) => validator.isInt(port + '', { min: 1, max: 65535 }),
    sshterm: (sshterm) => /^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(sshterm),
    cursorBlink: (cursorBlink) => validator.isBoolean(cursorBlink + ''),
    scrollback: (scrollback) => validator.isInt(scrollback + '', { min: 1, max: 200000 }),
    tabStopWidth: (tabStopWidth) => validator.isInt(tabStopWidth + '', { min: 1, max: 100 }),
    bellStyle: (bellStyle) => (['sound', 'none'].indexOf(bellStyle) > -1),
    readyTimeout: (readyTimeout) => validator.isInt(readyTimeout + '', { min: 1, max: 300000 }),
    header: () => true,
    headerBackground: () => true
  }
  const transformations = {
    cursorBlink: (cursorBlink) => myutil.parseBool(cursorBlink)
  }
  const rename = {
    sshterm: 'term'
  }

  // validate & transform and rename query parameters
  for (const key in queryParams) {
    const value = queryParams[key]
    const validator = validators[key] || (() => false)
    const transformation = transformations[key] || ((i) => i)
    const newName = rename[key] || key

    if (value !== undefined && validator(value)) {
      processedParams[newName] = transformation(value)
    }
  }

  // todo: address all this!!
  // const allowreplay = config.options.challengeButton || (validator.isBoolean(req.headers.allowreplay + '') ? myutil.parseBool(req.headers.allowreplay) : false)
  // const allowreauth = config.options.allowreauth || false
  // const mrhsession = ((validator.isAlphanumeric(req.headers.mrhsession + '') && req.headers.mrhsession) ? req.headers.mrhsession : 'none')
  // if (req.session.ssh.header.name) validator.escape(req.session.ssh.header.name)
  // if (req.session.ssh.header.background) validator.escape(req.session.ssh.header.background)
  // todo: do this when creating base config?
  // if (socketConfig.header.name) {
  //   validator.escape(socketConfig.header.name)
  // }
  // if (socketConfig.header.background) {
  //   validator.escape(socketConfig.header.background)
  // }

  // create config object from query parameters
  const config = pick(processedParams, ['host', 'port', 'readyTimeout', 'term'])
  config.terminal = pick(processedParams, ['cursorBlink', 'scrollback', 'tabStopWidth', 'bellStyle'])
  config.header = pick(processedParams, ['header', 'headerBackground'])

  return config
}

function getCredentials (session) {
  if (session.username && session.userpassword) {
    return {
      username: session.username,
      userpassword: session.userpassword
    }
  } else {
    return myutil.defaultCredentials
  }
}

/**
 * Error handling for various events. Outputs error to client, logs to
 * server, destroys session and disconnects socket.
 * @param {string} callerName            Function calling this function
 * @param {object} err                   Error object or error message
 * @param {object} context               Additional information about the state when the error occurred
 * @param {object} context.socket        The socket.io socket object at the time of failure
 * @param {object} context.socketConfig  The config object based on the base config and the request query parameters
 * @param {object} context.credentials   The credentials used during the connection that failed
 */
// eslint-disable-next-line complexity
function SSHError (callerName, err, { socket, credentials, socketConfig }) {
  var theError
  const session = socket.request.session

  if (session) {
    // we just want the first error of the session to pass to the client
    session.error = session.error || ((err) ? err.message : undefined)
    theError = session.error ? ': ' + session.error : ''

    // log unsuccessful login attempt
    if (err && (err.level === 'client-authentication')) {
      console.log('WebSSH2 ' + 'error: Authentication failure'.red.bold +
        ' user=' + credentials.username.yellow.bold.underline +
        ' from=' + socket.handshake.address.yellow.bold.underline)

      socket.emit('allowreauth', socketConfig.allowreauth)
      socket.emit('reauth')
    } else {
      console.log('WebSSH2 Logout: user=' + credentials.username +
        ' from=' + socket.handshake.address +
        ' host=' + socketConfig.host +
        ' port=' + socketConfig.port +
        ' sessionID=' + socket.request.sessionID + '/' + socket.id +
        ' allowreplay=' + socketConfig.allowreplay +
        ' term=' + socketConfig.term
      )
      if (err) {
        theError = err ? ': ' + err.message : ''
        console.log('WebSSH2 error' + theError)
      }
    }

    socket.emit('ssherror', 'SSH ' + callerName + theError)
    session.destroy()
  } else {
    theError = (err) ? ': ' + err.message : ''
  }

  socket.disconnect(true)

  debugWebSSH2('SSHError ' + callerName + theError)
}

// public
module.exports = function socket (socket) {
  // create new config by merging config object from disk with config object from the request
  const socketConfig = Object.assign({}, baseSocketConfig, getValidatedRequestConfig(socket.handshake.query))
  const credentials = getCredentials(socket.request.session)
  const hasCredentials = credentials.username && (credentials.userpassword || credentials.privatekey)
  const errorContext = { socket, credentials, socketConfig };

  if (!(hasCredentials && socketConfig)) {
    debugWebSSH2('Attempt to connect without session.username/password or session varialbles defined, ' +
      'potentially previously abandoned client session. disconnecting websocket client.\r\n' +
      'Handshake information: \r\n  ' + JSON.stringify(socket.handshake))
    socket.emit('ssherror', 'WEBSOCKET ERROR - Refresh the browser and try again')
    socket.request.session.destroy()
    socket.disconnect(true)
    return
  }

  // If configured, check that requsted host is in a permitted subnet
  if (socketConfig.allowedSubnets.length > 0) {
    const matcher = new CIDRMatcher(socketConfig.allowedSubnets)
    if (!matcher.contains(socketConfig.host)) {
      console.log('WebSSH2 ' + 'error: Requested host outside configured subnets / REJECTED'.red.bold +
        ' user=' + credentials.username.yellow.bold.underline +
        ' from=' + socket.handshake.address.yellow.bold.underline)
      socket.emit('ssherror', '401 UNAUTHORIZED')
      socket.disconnect(true)
      return
    }
  }

  const conn = new SSH()

  socket.on('geometry', function socketOnGeometry (cols, rows) {
    termCols = cols
    termRows = rows
  })

  conn.on('banner', function connOnBanner (data) {
    // need to convert to cr/lf for proper formatting
    data = data.replace(/\r?\n/g, '\r\n')
    socket.emit('data', data.toString('utf-8'))
  })

  conn.on('ready', function connOnReady () {
    console.log('WebSSH2 Login: user=' + credentials.username +
      ' from=' + socket.handshake.address +
      ' host=' + socketConfig.host +
      ' port=' + socketConfig.port +
      ' sessionID=' + socket.request.sessionID + '/' + socket.id +
      ' mrhsession=' + socketConfig.mrhsession +
      ' allowreplay=' + socketConfig.allowreplay +
      ' term=' + socketConfig.term
    )

    socket.emit('menu', menuData)
    socket.emit('allowreauth', socketConfig.allowreauth)
    socket.emit('setTerminalOpts', socketConfig.terminal)
    socket.emit('title', 'ssh://' + socketConfig.host)
    if (socketConfig.header.background) socket.emit('headerBackground', socketConfig.header.background)
    if (socketConfig.header.name) socket.emit('header', socketConfig.header.name)
    socket.emit('footer', 'ssh://' + credentials.username + '@' + socketConfig.host + ':' + socketConfig.port)
    socket.emit('status', 'SSH CONNECTION ESTABLISHED')
    socket.emit('statusBackground', 'green')
    socket.emit('allowreplay', socketConfig.allowreplay)

    conn.shell({
      term: socketConfig.term,
      cols: termCols,
      rows: termRows
    }, function connShell (err, stream) {
      if (err) {
        SSHError('EXEC ERROR', err, errorContext)
        conn.end()
        return
      }
      // poc to log commands from client
      if (socketConfig.serverlog.client) var dataBuffer
      socket.on('data', function socketOnData (data) {
        stream.write(data)
        // poc to log commands from client
        if (socketConfig.serverlog.client) {
          if (data === '\r') {
            console.log('serverlog.client: ' + socket.request.session.id + '/' + socket.id + ' host: ' + socketConfig.host + ' command: ' + dataBuffer)
            dataBuffer = undefined
          } else {
            dataBuffer = (dataBuffer) ? dataBuffer + data : data
          }
        }
      })
      socket.on('control', function socketOnControl (controlData) {
        switch (controlData) {
          case 'replayCredentials':
            if (socketConfig.allowreplay) {
              stream.write(credentials.userpassword + '\n')
            }
          /* falls through */
          default:
            console.log('controlData: ' + controlData)
        }
      })
      socket.on('resize', function socketOnResize (data) {
        stream.setWindow(data.rows, data.cols)
      })
      socket.on('disconnecting', function socketOnDisconnecting (reason) { debugWebSSH2('SOCKET DISCONNECTING: ' + reason) })
      socket.on('disconnect', function socketOnDisconnect (reason) {
        debugWebSSH2('SOCKET DISCONNECT: ' + reason)
        err = { message: reason }
        SSHError('CLIENT SOCKET DISCONNECT', err, errorContext)
        conn.end()
        // socket.request.session.destroy()
      })
      socket.on('error', function socketOnError (err) {
        SSHError('SOCKET ERROR', err, errorContext)
        conn.end()
      })

      stream.on('data', function streamOnData (data) { socket.emit('data', data.toString('utf-8')) })
      stream.on('close', function streamOnClose (code, signal) {
        err = { message: ((code || signal) ? (((code) ? 'CODE: ' + code : '') + ((code && signal) ? ' ' : '') + ((signal) ? 'SIGNAL: ' + signal : '')) : undefined) }
        SSHError('STREAM CLOSE', err, errorContext)
        conn.end()
      })
      stream.stderr.on('data', function streamStderrOnData (data) {
        console.log('STDERR: ' + data)
      })
    })
  })

  conn.on('end', function connOnEnd (err) { SSHError('CONN END BY HOST', err, errorContext) })
  conn.on('close', function connOnClose (err) { SSHError('CONN CLOSE', err, errorContext) })
  conn.on('error', function connOnError (err) { SSHError('CONN ERROR', err, errorContext) })
  conn.on('keyboard-interactive', function connOnKeyboardInteractive (name, instructions, instructionsLang, prompts, finish) {
    debugWebSSH2('conn.on(\'keyboard-interactive\')')
    finish([credentials.userpassword])
  })

  // console.log('hostkeys: ' + hostkeys[0].[0])
  conn.connect({
    host: socketConfig.host,
    port: socketConfig.port,
    localAddress: socketConfig.localAddress,
    localPort: socketConfig.localPort,
    username: credentials.username,
    password: credentials.userpassword,
    privateKey: credentials.privatekey,
    tryKeyboard: true,
    algorithms: socketConfig.algorithms,
    readyTimeout: socketConfig.readyTimeout,
    keepaliveInterval: socketConfig.keepaliveInterval,
    keepaliveCountMax: socketConfig.keepaliveCountMax,
    debug: debug('ssh2')
  })
}
