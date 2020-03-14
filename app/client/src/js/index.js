'use strict'

import * as io from 'socket.io-client'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
/* import * as fit from 'xterm/dist/addons/fit/fit'
 */
import { library, dom } from '@fortawesome/fontawesome-svg-core'
import { faBars, faClipboard, faDownload, faKey, faCog } from '@fortawesome/free-solid-svg-icons'
library.add(faBars, faClipboard, faDownload, faKey, faCog)
dom.watch()

require('xterm/css/xterm.css')
require('../css/style.css')

/* global Blob, logBtn, credentialsBtn, reauthBtn, downloadLogBtn */
var sessionLogEnable = false
var loggedData = false
var allowreplay = false
var allowreauth = false
var sessionLog, sessionFooter, logDate, currentDate, myFile, errorExists
var socket, termid // eslint-disable-line
const term = new Terminal()
// DOM properties
var status = document.getElementById('status')
var header = document.getElementById('header')
var dropupContent = document.getElementById('dropupContent')
var footer = document.getElementById('footer')
var fitAddon = new FitAddon()
var terminalContainer = document.getElementById('terminal-container')
term.loadAddon(fitAddon)
term.open(terminalContainer)
term.focus()
fitAddon.fit()

window.addEventListener('resize', resizeScreen, false)

function resizeScreen () {
  fitAddon.fit()
  socket.emit('resize', { cols: term.cols, rows: term.rows })
}

socket = io.connect({
  path: '/ssh/socket.io'
})

term.onData(function (data) {
  socket.emit('data', data)
})

socket.on('data', function (data) {
  term.write(data)
  if (sessionLogEnable) {
    sessionLog = sessionLog + data
  }
})

socket.on('connect', function () {
  socket.emit('geometry', term.cols, term.rows)
})

socket.on('setTerminalOpts', function (data) {
  term.setOption('cursorBlink', data.cursorBlink)
  term.setOption('scrollback', data.scrollback)
  term.setOption('tabStopWidth', data.tabStopWidth)
  term.setOption('bellStyle', data.bellStyle)
})

socket.on('title', function (data) {
  document.title = data
})

socket.on('menu', function (data) {
  drawMenu(data)
})

socket.on('status', function (data) {
  status.innerHTML = data
})

socket.on('ssherror', function (data) {
  status.innerHTML = data
  status.style.backgroundColor = 'red'
  errorExists = true
})

socket.on('headerBackground', function (data) {
  header.style.backgroundColor = data
})

socket.on('header', function (data) {
  if (data) {
    header.innerHTML = data
    header.style.display = 'block'
    // header is 19px and footer is 19px, recaculate new terminal-container and resize
    terminalContainer.style.height = 'calc(100% - 38px)'
    resizeScreen()
  }
})

socket.on('footer', function (data) {
  sessionFooter = data
  footer.innerHTML = data
})

socket.on('statusBackground', function (data) {
  status.style.backgroundColor = data
})

socket.on('allowreplay', function (data) {
  if (data === true) {
    console.log('allowreplay: ' + data)
    allowreplay = true
    drawMenu(dropupContent.innerHTML + '<a id="credentialsBtn"><i class="fas fa-key fa-fw"></i> Credentials</a>')
  } else {
    allowreplay = false
    console.log('allowreplay: ' + data)
  }
})

socket.on('allowreauth', function (data) {
  if (data === true) {
    console.log('allowreauth: ' + data)
    allowreauth = true
    drawMenu(dropupContent.innerHTML + '<a id="reauthBtn"><i class="fas fa-key fa-fw"></i> Switch User</a>')
  } else {
    allowreauth = false
    console.log('allowreauth: ' + data)
  }
})

socket.on('disconnect', function (err) {
  if (!errorExists) {
    status.style.backgroundColor = 'red'
    status.innerHTML =
      'WEBSOCKET SERVER DISCONNECTED: ' + err
  }
  socket.io.reconnection(false)
})

socket.on('error', function (err) {
  if (!errorExists) {
    status.style.backgroundColor = 'red'
    status.innerHTML = 'ERROR: ' + err
  }
})

socket.on('reauth', function () {
  (allowreauth) && reauthSession()
})

term.onTitleChange(function (title) {
  document.title = title
})

// draw/re-draw menu and reattach listeners
// when dom is changed, listeners are abandonded
function drawMenu (data) {
  dropupContent.innerHTML = data
  logBtn.addEventListener('click', toggleLog)
  allowreauth && reauthBtn.addEventListener('click', reauthSession)
  allowreplay && credentialsBtn.addEventListener('click', replayCredentials)
  loggedData && downloadLogBtn.addEventListener('click', downloadLog)
}

// reauthenticate
function reauthSession () { // eslint-disable-line
  console.log('re-authenticating')
  window.location.href = '/ssh/reauth'
  return false
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
    logBtn.innerHTML = '<i class="fas fa-clipboard fa-fw"></i> Start Log'
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
    logBtn.innerHTML = '<i class="fas fa-cog fa-spin fa-fw"></i> Stop Log'
    downloadLogBtn.style.color = '#000'
    downloadLogBtn.addEventListener('click', downloadLog)
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
    var blob = new Blob([sessionLog.replace(/[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><;]/g, '')], { // eslint-disable-line no-control-regex
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
