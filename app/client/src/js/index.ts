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
let errorExists: boolean;
const term = new Terminal();
// DOM properties
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
  query: {
    sessionId,
    devboxId,
    env: 'dev',
  },
});

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
