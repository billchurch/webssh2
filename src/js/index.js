import * as io from '../../node_modules/socket.io/node_modules/socket.io-client/dist/socket.io.js'
import * as Terminal from '../../node_modules/xterm/dist/xterm'
import * as fit from '../../node_modules/xterm/dist/addons/fit/fit'

require('../../node_modules/xterm/dist/xterm.css')
require('../css/style.css')

Terminal.applyAddon(fit)

/* global Blob */

var sessionLogEnable = false
var sessionLog, sessionFooter, logDate, currentDate, myFile, errorExists

var downloadLogButton = document.getElementById('downloadLog')
var credentialsButton = document.getElementById('credentials')
var toggleLogButton = document.getElementById('toggleLog')

toggleLogButton.addEventListener('click', toggleLog)

downloadLogButton.style.display = 'none'
credentialsButton.style.display = 'none'

var terminalContainer = document.getElementById('terminal-container')

var term = new Terminal({
  cursorBlink: true
})
var socket, termid // eslint-disable-line
term.open(terminalContainer)
term.focus()
// term.applyAddon(fit)

if (document.location.pathname) {
  var parts = document.location.pathname.split('/')
  var base = parts.slice(0, parts.length - 1).join('/') + '/'
  var resource = base.substring(1) + 'socket.io'
  socket = io.connect(null, {
    resource: resource
  })
} else {
  socket = io.connect()
}

socket.on('connect', function () {
  socket.emit('geometry', term.cols, term.rows)
  term.on('data', function (data) {
    socket.emit('data', data)
  })
  socket.on('title', function (data) {
    document.title = data
  }).on('status', function (data) {
    document.getElementById('status').innerHTML = data
  }).on('ssherror', function (data) {
    document.getElementById('status').innerHTML = data
    document.getElementById('status').style.backgroundColor = 'red'
    errorExists = true
  }).on('headerBackground', function (data) {
    document.getElementById('header').style.backgroundColor = data
  }).on('header', function (data) {
    document.getElementById('header').innerHTML = data
  }).on('footer', function (data) {
    sessionFooter = data
    document.getElementById('footer').innerHTML = data
  }).on('statusBackground', function (data) {
    document.getElementById('status').style.backgroundColor = data
  }).on('allowreplay', function (data) {
    if (data === true) {
      console.log('allowreplay: ' + data)
      credentialsButton.style.display = 'inline'
      credentialsButton.addEventListener('click', replayCredentials)
    } else {
      credentialsButton.style.display = 'none'
    }
  }).on('data', function (data) {
    term.write(data)
    if (sessionLogEnable) {
      sessionLog = sessionLog + data
    }
  }).on('disconnect', function (err) {
    if (!errorExists) {
      document.getElementById('status').style.backgroundColor = 'red'
      document.getElementById('status').innerHTML =
        'WEBSOCKET SERVER DISCONNECTED: ' + err
    }
    socket.io.reconnection(false)
  }).on('error', function (err) {
    if (!errorExists) {
      document.getElementById('status').style.backgroundColor = 'red'
      document.getElementById('status').innerHTML = 'ERROR: ' + err
    }
  })
})

// replay password to server, requires
// bill test

function replayCredentials () { // eslint-disable-line
  socket.emit('control', 'replayCredentials')
  console.log('replaying credentials')
  term.focus()
  return false
}

// Set variable to toggle log data from client/server to a varialble
// for later download
function toggleLog () { // eslint-disable-line
  if (sessionLogEnable === true) {
    sessionLogEnable = false
    toggleLogButton.innerHTML =
      '<a class="toggleLog" href="javascript:void(0);">Start Log</a>'
    console.log('stopping log, ' + sessionLogEnable)
    currentDate = new Date()
    sessionLog = sessionLog + '\r\n\r\nLog End for ' + sessionFooter + ': ' +
      currentDate.getFullYear() + '/' + (currentDate.getMonth() + 1) + '/' +
      currentDate.getDate() + ' @ ' + currentDate.getHours() + ':' +
      currentDate.getMinutes() + ':' + currentDate.getSeconds() + '\r\n'
    logDate = currentDate
    term.focus()
    return false
  } else {
    sessionLogEnable = true
    toggleLogButton.innerHTML =
      '<a class="toggleLog" href="javascript:void(0)">Logging - STOP LOG</a>'
    downloadLogButton.style.display = 'inline'
    downloadLogButton.addEventListener('click', downloadLog)
    console.log('starting log, ' + sessionLogEnable)
    currentDate = new Date()
    sessionLog = 'Log Start for ' + sessionFooter + ': ' +
      currentDate.getFullYear() + '/' + (currentDate.getMonth() + 1) + '/' +
      currentDate.getDate() + ' @ ' + currentDate.getHours() + ':' +
      currentDate.getMinutes() + ':' + currentDate.getSeconds() + '\r\n\r\n'
    logDate = currentDate
    term.focus()
    return false
  }
}

// cross browser method to "download" an element to the local system
// used for our client-side logging feature
function downloadLog () { // eslint-disable-line
  myFile = 'WebSSH2-' + logDate.getFullYear() + (logDate.getMonth() + 1) +
    logDate.getDate() + '_' + logDate.getHours() + logDate.getMinutes() +
    logDate.getSeconds() + '.log'
    // regex should eliminate escape sequences from being logged.
  var blob = new Blob([sessionLog.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')], {
    type: 'text/plain'
  })
  if (window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveBlob(blob, myFile)
  } else {
    var elem = window.document.createElement('a')
    elem.href = window.URL.createObjectURL(blob)
    elem.download = myFile
    document.body.appendChild(elem)
    elem.click()
    document.body.removeChild(elem)
  }
  term.focus()
}
