/* eslint-disable import/no-extraneous-dependencies */
import { io } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { library, dom } from '@fortawesome/fontawesome-svg-core';
import { faBars, faClipboard, faDownload, faKey, faCog } from '@fortawesome/free-solid-svg-icons';

library.add(faBars, faClipboard, faDownload, faKey, faCog);
dom.watch();

const debug = require('debug')('WebSSH2');
require('@xterm/xterm/css/xterm.css');
require('../css/style.css');

/* global Blob, logBtn, credentialsBtn, reauthBtn, downloadLogBtn */ // eslint-disable-line
let sessionLogEnable = false;
let loggedData = false;
let sessionLog: string;
let sessionFooter: any;
let logDate: {
  getFullYear: () => any;
  getMonth: () => number;
  getDate: () => any;
  getHours: () => any;
  getMinutes: () => any;
  getSeconds: () => any;
};
let currentDate: Date;
let myFile: string;
let errorExists: boolean;
const term = new Terminal();
// DOM properties
const logBtn = document.getElementById('logBtn');
const downloadLogBtn = document.getElementById('downloadLogBtn');
const status = document.getElementById('status');
const fitAddon = new FitAddon();
const terminalContainer = document.getElementById('terminal-container');
term.options = {
  cursorBlink: true,
  scrollback: 10000,
  tabStopWidth: 8,
};
term.loadAddon(fitAddon);
term.open(terminalContainer);
term.focus();
fitAddon.fit();
//get uri param for devbox
const urlParams = new URLSearchParams(window.location.search);
const devboxId = urlParams.get('devboxId');
const sessionId = urlParams.get('sessionId');

const socket = io({
  path: '/ssh/socket.io',
  transports: ['websocket'],
  extraHeaders: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    DevboxId: devboxId,
  },
  query: {
    sessionId,
    devboxId,
  },
});

// cross browser method to "download" an element to the local system
// used for our client-side logging feature
function downloadLog() {
  // eslint-disable-line
  if (loggedData === true) {
    myFile = `WebSSH2-${logDate.getFullYear()}${
      logDate.getMonth() + 1
    }${logDate.getDate()}_${logDate.getHours()}${logDate.getMinutes()}${logDate.getSeconds()}.log`;
    // regex should eliminate escape sequences from being logged.
    const blob = new Blob(
      [
        sessionLog.replace(
          // eslint-disable-next-line no-control-regex
          /[\u001b\u009b][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><;]/g,
          '',
        ),
      ],
      {
        // eslint-disable-line no-control-regex
        type: 'text/plain',
      },
    );
    const elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = myFile;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }
  term.focus();
}
// Set variable to toggle log data from client/server to a varialble
// for later download
function toggleLog() {
  // eslint-disable-line
  if (sessionLogEnable === true) {
    sessionLogEnable = false;
    loggedData = true;
    logBtn.innerHTML = '<i class="fas fa-clipboard fa-fw"></i> Start Log';
    currentDate = new Date();
    sessionLog = `${sessionLog}\r\n\r\nLog End for ${sessionFooter}: ${currentDate.getFullYear()}/${
      currentDate.getMonth() + 1
    }/${currentDate.getDate()} @ ${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}\r\n`;
    logDate = currentDate;
    term.focus();
    return false;
  }
  sessionLogEnable = true;
  loggedData = true;
  logBtn.innerHTML = '<i class="fas fa-cog fa-spin fa-fw"></i> Stop Log';
  downloadLogBtn.style.color = '#000';
  downloadLogBtn.addEventListener('click', downloadLog);
  currentDate = new Date();
  sessionLog = `Log Start for ${sessionFooter}: ${currentDate.getFullYear()}/${
    currentDate.getMonth() + 1
  }/${currentDate.getDate()} @ ${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}\r\n\r\n`;
  logDate = currentDate;
  term.focus();
  return false;
}

function resizeScreen() {
  fitAddon.fit();
  socket.emit('resize', { cols: term.cols, rows: term.rows });
  debug(`resize: ${JSON.stringify({ cols: term.cols, rows: term.rows })}`);
}

window.addEventListener('resize', resizeScreen, false);

term.onData((data) => {
  socket.emit('data', data);
});

socket.on('data', (data: string | Uint8Array) => {
  term.write(data);
  if (sessionLogEnable) {
    sessionLog += data;
  }
});

socket.on('connect', () => {
  socket.emit('geometry', term.cols, term.rows);
  debug(`geometry: ${term.cols}, ${term.rows}`);
});

// socket.on('ssherror', (data: string) => {
//   status.innerHTML = data;
//   status.style.backgroundColor = 'red';
//   errorExists = true;
// });

// socket.on('headerBackground', (data: string) => {
//   header.style.backgroundColor = data;
// });

socket.on('disconnect', (err: any) => {
  if (!errorExists) {
    status.style.backgroundColor = 'red';
    status.innerHTML = `WEBSOCKET SERVER DISCONNECTED: ${err}`;
  }
  socket.io.reconnection(false);
});

// socket.on('error', (err: any) => {
//   if (!errorExists) {
//     status.style.backgroundColor = 'red';
//     status.innerHTML = `ERROR: ${err}`;
//   }
// });

// socket.on('reauth', () => {
//   if (allowreauth) {
//     reauthSession();
//   }
// });

// safe shutdown

// socket.on('shutdownCountdownUpdate', (remainingSeconds: any) => {
//   if (!hasCountdownStarted) {
//     countdown.classList.add('active');
//     hasCountdownStarted = true;
//   }
//   countdown.innerText = `Shutting down in ${remainingSeconds}s`;
// });

// term.onTitleChange((title) => {
//   document.title = title;
// });
