'use strict'

import * as io from '../../node_modules/socket.io-client/dist/socket.io.js'
import * as Terminal from '../../node_modules/xterm/dist/xterm'
import * as fit from '../../node_modules/xterm/dist/addons/fit/fit'
// import 'font-awesome/css/font-awesome.css'
//
// import '@fortawesome/fontawesome/styles.css'
import fontawesome from '@fortawesome/fontawesome'
import faBars from '@fortawesome/fontawesome-free-solid/faBars'
import faQuestion from '@fortawesome/fontawesome-free-solid/faQuestion'
import faClipboard from '@fortawesome/fontawesome-free-solid/faClipboard'
import faDownload from '@fortawesome/fontawesome-free-solid/faDownload'
import faKey from '@fortawesome/fontawesome-free-solid/faKey'
import faCog from '@fortawesome/fontawesome-free-solid/faCog'

fontawesome.library.add(faBars, faQuestion, faClipboard, faDownload, faKey, faCog)

fontawesome.config.searchPseudoElements = true

fontawesome.dom.i2svg()

require('../../node_modules/xterm/dist/xterm.css')
require('../css/style.css')

Terminal.applyAddon(fit)

/* global Blob */

var sessionLogEnable = false
var loggedData = false
var sessionLog, sessionFooter, logDate, currentDate, myFile, errorExists

var downloadLogButton = document.getElementById('downloadLog')
var credentialsBtn = document.getElementById('credentialsBtn')
var toggleLogButton = document.getElementById('toggleLog')

toggleLogButton.addEventListener('click', toggleLog)

downloadLogButton.style.color = '#666'
credentialsBtn.style.color = '#666'

var terminalContainer = document.getElementById('terminal-container')

var term = new Terminal({
  cursorBlink: true
})
var socket, termid // eslint-disable-line
term.open(terminalContainer)
term.focus()
term.fit()

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
  console.log('geometry cols: ' + term.cols + ' rows: ' + term.rows)
})
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
    credentialsBtn.style.color = '#000'
    credentialsBtn.addEventListener('click', replayCredentials)
  } else {
    console.log('allowreplay: ' + data)
    credentialsBtn.style.color = '#666'
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

// About Modal Stuff
var aboutModal = document.getElementById('aboutModal')
var aboutBtn = document.getElementById('aboutBtn')
var aboutClose = document.getElementsByClassName('aboutClose')[0]
aboutBtn.onclick = function () {
  aboutModal.style.display = 'block'
}
aboutClose.onclick = function () {
  aboutModal.style.display = 'none'
  term.focus()
}
window.onclick = function (event) {
  if (event.target == aboutModal) {
    aboutModal.style.display = 'none'
    term.focus()
  }
}

// replay password to server, requires
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
    loggedData = true
    toggleLogButton.innerHTML = '<i class="fas fa-clipboard"></i> Start Log'
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
    loggedData = true
    toggleLogButton.innerHTML = '<i class="fas fa-cog fa-spin"></i> Stop Log'
    downloadLogButton.style.color = '#000'
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
  if (loggedData === true) {
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
  }
  term.focus()
}
