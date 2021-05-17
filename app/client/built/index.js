/* eslint-disable import/no-extraneous-dependencies */
import io from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { library, dom } from '@fortawesome/fontawesome-svg-core';
import { faBars, faClipboard, faDownload, faKey, faCog } from '@fortawesome/free-solid-svg-icons';
library.add(faBars, faClipboard, faDownload, faKey, faCog);
dom.watch();
const debug = require('debug')('WebSSH2');
require('xterm/css/xterm.css');
require('../css/style.css');
/* global Blob, logBtn, credentialsBtn, reauthBtn, downloadLogBtn */ // eslint-disable-line
let sessionLogEnable = false;
let loggedData = false;
let allowreplay = false;
let allowreauth = false;
let sessionLog;
let sessionFooter;
let logDate;
let currentDate;
let myFile;
let errorExists;
let socket;
const term = new Terminal();
// DOM properties
const status = document.getElementById('status');
const header = document.getElementById('header');
const dropupContent = document.getElementById('dropupContent');
const footer = document.getElementById('footer');
const countdown = document.getElementById('countdown');
const fitAddon = new FitAddon();
const terminalContainer = document.getElementById('terminal-container');
term.loadAddon(fitAddon);
term.open(terminalContainer);
term.focus();
fitAddon.fit();
// reauthenticate
function reauthSession() {
    debug('re-authenticating');
    window.location.href = '/ssh/reauth';
    return false;
}
// cross browser method to "download" an element to the local system
// used for our client-side logging feature
function downloadLog() {
    if (loggedData === true) {
        myFile = `WebSSH2-${logDate.getFullYear()}${logDate.getMonth() + 1}${logDate.getDate()}_${logDate.getHours()}${logDate.getMinutes()}${logDate.getSeconds()}.log`;
        // regex should eliminate escape sequences from being logged.
        const blob = new Blob([
            sessionLog.replace(
            // eslint-disable-next-line no-control-regex
            /[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><;]/g, ''),
        ], {
            // eslint-disable-line no-control-regex
            type: 'text/plain',
        });
        if (window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveBlob(blob, myFile);
        }
        else {
            const elem = window.document.createElement('a');
            elem.href = window.URL.createObjectURL(blob);
            elem.download = myFile;
            document.body.appendChild(elem);
            elem.click();
            document.body.removeChild(elem);
        }
    }
    term.focus();
}
// Set variable to toggle log data from client/server to a varialble
// for later download
function toggleLog() {
    if (sessionLogEnable === true) {
        sessionLogEnable = false;
        loggedData = true;
        logBtn.innerHTML = '<i class="fas fa-clipboard fa-fw"></i> Start Log';
        // console.log(`stopping log, ${sessionLogEnable}`);
        currentDate = new Date();
        sessionLog = `${sessionLog}\r\n\r\nLog End for ${sessionFooter}: ${currentDate.getFullYear()}/${currentDate.getMonth() + 1}/${currentDate.getDate()} @ ${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}\r\n`;
        logDate = currentDate;
        term.focus();
        return false;
    }
    sessionLogEnable = true;
    loggedData = true;
    logBtn.innerHTML = '<i class="fas fa-cog fa-spin fa-fw"></i> Stop Log';
    downloadLogBtn.style.color = '#000';
    downloadLogBtn.addEventListener('click', downloadLog);
    // console.log(`starting log, ${sessionLogEnable}`);
    currentDate = new Date();
    sessionLog = `Log Start for ${sessionFooter}: ${currentDate.getFullYear()}/${currentDate.getMonth() + 1}/${currentDate.getDate()} @ ${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}\r\n\r\n`;
    logDate = currentDate;
    term.focus();
    return false;
}
// replay password to server, requires
function replayCredentials() {
    socket.emit('control', 'replayCredentials');
    // console.log('replaying credentials');
    term.focus();
    return false;
}
// draw/re-draw menu and reattach listeners
// when dom is changed, listeners are abandonded
function drawMenu(data) {
    dropupContent.innerHTML = data;
    logBtn.addEventListener('click', toggleLog);
    if (allowreauth) {
        reauthBtn.addEventListener('click', reauthSession);
    }
    if (allowreplay) {
        credentialsBtn.addEventListener('click', replayCredentials);
    }
    if (loggedData) {
        downloadLogBtn.addEventListener('click', downloadLog);
    }
}
function resizeScreen() {
    fitAddon.fit();
    socket.emit('resize', { cols: term.cols, rows: term.rows });
}
window.addEventListener('resize', resizeScreen, false);
socket = io.connect({
    path: '/ssh/socket.io',
});
term.onData((data) => {
    socket.emit('data', data);
});
socket.on('data', (data) => {
    term.write(data);
    if (sessionLogEnable) {
        sessionLog += data;
    }
});
socket.on('connect', () => {
    socket.emit('geometry', term.cols, term.rows);
});
socket.on('setTerminalOpts', (data) => {
    term.setOption('cursorBlink', data.cursorBlink);
    term.setOption('scrollback', data.scrollback);
    term.setOption('tabStopWidth', data.tabStopWidth);
    term.setOption('bellStyle', data.bellStyle);
});
socket.on('title', (data) => {
    document.title = data;
});
socket.on('menu', (data) => {
    drawMenu(data);
});
socket.on('status', (data) => {
    status.innerHTML = data;
});
socket.on('ssherror', (data) => {
    status.innerHTML = data;
    status.style.backgroundColor = 'red';
    errorExists = true;
});
socket.on('headerBackground', (data) => {
    header.style.backgroundColor = data;
});
socket.on('header', (data) => {
    if (data) {
        header.innerHTML = data;
        header.style.display = 'block';
        // header is 19px and footer is 19px, recaculate new terminal-container and resize
        terminalContainer.style.height = 'calc(100% - 38px)';
        resizeScreen();
    }
});
socket.on('footer', (data) => {
    sessionFooter = data;
    footer.innerHTML = data;
});
socket.on('statusBackground', (data) => {
    status.style.backgroundColor = data;
});
socket.on('allowreplay', (data) => {
    if (data === true) {
        debug(`allowreplay: ${data}`);
        allowreplay = true;
        drawMenu(`${dropupContent.innerHTML}<a id="credentialsBtn"><i class="fas fa-key fa-fw"></i> Credentials</a>`);
    }
    else {
        allowreplay = false;
        debug(`allowreplay: ${data}`);
    }
});
socket.on('allowreauth', (data) => {
    if (data === true) {
        debug(`allowreauth: ${data}`);
        allowreauth = true;
        drawMenu(`${dropupContent.innerHTML}<a id="reauthBtn"><i class="fas fa-key fa-fw"></i> Switch User</a>`);
    }
    else {
        allowreauth = false;
        debug(`allowreauth: ${data}`);
    }
});
socket.on('disconnect', (err) => {
    if (!errorExists) {
        status.style.backgroundColor = 'red';
        status.innerHTML = `WEBSOCKET SERVER DISCONNECTED: ${err}`;
    }
    socket.io.reconnection(false);
    countdown.classList.remove('active');
});
socket.on('error', (err) => {
    if (!errorExists) {
        status.style.backgroundColor = 'red';
        status.innerHTML = `ERROR: ${err}`;
    }
});
socket.on('reauth', () => {
    if (allowreauth) {
        reauthSession();
    }
});
// safe shutdown
let hasCountdownStarted = false;
socket.on('shutdownCountdownUpdate', (remainingSeconds) => {
    if (!hasCountdownStarted) {
        countdown.classList.add('active');
        hasCountdownStarted = true;
    }
    countdown.innerText = `Shutting down in ${remainingSeconds}s`;
});
term.onTitleChange((title) => {
    document.title = title;
});
