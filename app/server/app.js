/* jshint esversion: 6, asi: true, node: true */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }],
   no-console: ["error", { allow: ["warn", "error", "info"] }] */
// app.js

// eslint-disable-next-line import/order
const config = require('./config');
const path = require('path');

const nodeRoot = path.dirname(require.main.filename);
const publicPath = path.join(nodeRoot, 'client', 'public');
const express = require('express');
const logger = require('morgan');
const crypto = require('crypto');

const expressConfig = {
  secret: crypto.randomBytes(20).toString('hex'),
  name: 'WebSSH2',
  resave: true,
  saveUninitialized: false,
  unset: 'destroy',
  ssh: {
    dotfiles: 'ignore',
    etag: false,
    extensions: ['htm', 'html'],
    index: false,
    maxAge: '1s',
    redirect: false,
    setHeaders(res) {
      res.set('x-timestamp', Date.now());
    },
  },
};

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { transports: ['websocket'], ...config.socketio });

const appSocket = require('./socket');
const { connect } = require('./routes');

// eslint-disable-next-line consistent-return
function safeShutdownGuard(req, res, next) {
  if (!shutdownMode) return next();
  res.status(503).end('Service unavailable: Server shutting down');
}
// express
app.use(safeShutdownGuard);

app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true }));
app.post('/ssh/host/:host?', connect);
app.post('/ssh', express.static(publicPath, expressConfig.ssh));
app.use('/ssh', express.static(publicPath, expressConfig.ssh));
//app.use(basicAuth);
//app.get('/ssh/reauth', reauth);
app.get('/ssh/host/:host?', connect);
// app.use(notfound);
// app.use(handleErrors);

// clean stop
function stopApp(reason) {
  shutdownMode = false;
  if (reason) console.info(`Stopping: ${reason}`);
  clearInterval(shutdownInterval);
  io.close();
  server.close();
}

// bring up socket
io.on('connection', appSocket);

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
