/* jshint esversion: 6, asi: true, node: true */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }],
   no-console: ["error", { allow: ["warn", "error", "info"] }] */
// app.js

// eslint-disable-next-line import/order
const config = require('./config');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const appSocket = require('./socket');
const { connectTerminalWS } = require('./routes');

const nodeRoot = path.dirname(require.main.filename);
const publicPath = path.join(nodeRoot, 'client', 'public');
const express = require('express');

const staticFileConfig = {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html'],
  index: false,
  maxAge: '1s',
  redirect: false,
  setHeaders(res) {
    res.set('x-timestamp', Date.now());
  },
};

function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = socketIO(server, {
    transports: ['websocket'],
    serveClient: false,
    path: '/ssh/socket.io',
    origins: ['localhost:2224'],
    cors: { origin: '*' },
  });

  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: true }));
  app.post('/ssh/devbox/', connectTerminalWS);
  // ======== To remove ========
  // Static files..
  app.post('/ssh', express.static(publicPath, staticFileConfig));
  app.use('/ssh', express.static(publicPath, staticFileConfig));
  // ===========================
  app.get('/ssh/devbox/', connectTerminalWS);

  io.on('connection', appSocket);

  return server;
}

const server = startServer();

module.exports = { server, config };

// const onConnection = (socket) => {
//   console.log('connected');
//   connectionCount += 1;
//   socket.on('disconnect', () => {
//     connectionCount -= 1;
//     if (connectionCount <= 0 && shutdownMode) {
//       stopApp('All clients disconnected');
//     }
//   });
//   socket.on('geometry', (cols, rows) => {
//     // TODO need to rework how we pass settings to ssh2, this is less than ideal
//     //socket.request.session.ssh.cols = cols; //TODO make this part of the terminal config on connect
//     //socket.request.session.ssh.rows = rows; WHAT IS THis it seems to work without it
//     //webssh2debug(socket, `SOCKET GEOMETRY: termCols = ${cols}, termRows = ${rows}`);
//   });
// };

// io.on('connection', onConnection);
