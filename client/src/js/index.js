'use strict'

import * as io from 'socket.io-client'
import * as Terminal from 'xterm/dist/xterm'
import * as fit from 'xterm/dist/addons/fit/fit'
// fontawesome, individual icon imports reduces file size dramatically but it's
// a little messy. this should be fixed by some updates with the fa library at some point
import fontawesome from '@fortawesome/fontawesome'
import faBars from '@fortawesome/fontawesome-free-solid/faBars'
// import faQuestion from '@fortawesome/fontawesome-free-solid/faQuestion'
import faClipboard from '@fortawesome/fontawesome-free-solid/faClipboard'
import faDownload from '@fortawesome/fontawesome-free-solid/faDownload'
import faKey from '@fortawesome/fontawesome-free-solid/faKey'
import faCog from '@fortawesome/fontawesome-free-solid/faCog'
fontawesome.library.add(faBars, faClipboard, faDownload, faKey, faCog)

require('xterm/dist/xterm.css')
require('../css/style.css')

Terminal.applyAddon(fit)

/* global Blob, logBtn, credentialsBtn, downloadLogBtn */
var sessionLogEnable = false
var loggedData = false
var allowreplay = false
var sessionLog, sessionFooter, logDate, currentDate, myFile, errorExists
var socket, termid // eslint-disable-line
var term = new Terminal()
// DOM properties
var status = document.getElementById('status')
var header = document.getElementById('header')
var dropupContent = document.getElementById('dropupContent')
var footer = document.getElementById('footer')
var terminalContainer = document.getElementById('terminal-container')
term.open(terminalContainer)
term.focus()
term.fit()

window.addEventListener('resize', resizeScreen, false)

function resizeScreen () {
  term.fit()
  socket.emit('resize', { cols: term.cols, rows: term.rows })
}

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

term.on('data', function (data) {
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

// draw/re-draw menu and reattach listeners
// when dom is changed, listeners are abandonded
function drawMenu (data) {
  dropupContent.innerHTML = data
  logBtn.addEventListener('click', toggleLog)
  allowreplay && credentialsBtn.addEventListener('click', replayCredentials)
  loggedData && downloadLogBtn.addEventListener('click', downloadLog)
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
