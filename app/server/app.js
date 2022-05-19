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

const app = express();
const server = require('http').Server(app);
const favicon = require('serve-favicon');
const io = require('socket.io')(server, config.socketio);
const session = require('express-session')(config.express);
const appSocket = require('./socket');
const myutil = require('./util');
const { reauth, connect, notfound, handleErrors } = require('./routes');

myutil.setDefaultCredentials(config);

// safe shutdown
let shutdownMode = false;
let shutdownInterval = 0;
let connectionCount = 0;
// eslint-disable-next-line consistent-return
function safeShutdownGuard(req, res, next) {
  if (shutdownMode) {
    res.status(503).end('Service unavailable: Server shutting down');
  } else {
    return next();
  }
}
// express
app.use(safeShutdownGuard);
app.use(session);
if (config.accesslog) app.use(logger('common'));
app.disable('x-powered-by');
app.use(favicon(path.join(publicPath, 'favicon.ico')));
app.use('/ssh', express.static(publicPath, config.express.ssh));
app.use(myutil.basicAuth);
app.get('/ssh/reauth', reauth);
app.get('/ssh/host/:host?', connect);
app.use(notfound);
app.use(handleErrors);

// clean stop
function stopApp(reason) {
  shutdownMode = false;
  if (reason) console.info(`Stopping: ${reason}`);
  if (shutdownInterval) clearInterval(shutdownInterval);
  io.close();
  server.close();
}

// bring up socket
io.on('connection', appSocket);

// socket.io
// expose express session with socket.request.session
io.use((socket, next) => {
  socket.request.res ? session(socket.request, socket.request.res, next) : next(next); // eslint disable-line
});

io.on('connection', (socket) => {
  connectionCount += 1;

  socket.on('disconnect', () => {
    connectionCount -= 1;
    if (connectionCount <= 0 && shutdownMode) {
      stopApp('All clients disconnected');
    }
  });
});

const signals = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) =>
  process.on(signal, () => {
    if (shutdownMode) stopApp('Safe shutdown aborted, force quitting');
    else if (connectionCount > 0) {
      let remainingSeconds = config.safeShutdownDuration;
      shutdownMode = true;
      const message =
        connectionCount === 1 ? ' client is still connected' : ' clients are still connected';
      console.error(connectionCount + message);
      console.error(`Starting a ${remainingSeconds} seconds countdown`);
      console.error('Press Ctrl+C again to force quit');

      shutdownInterval = setInterval(() => {
        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
          stopApp('Countdown is over');
        } else {
          io.sockets.emit('shutdownCountdownUpdate', remainingSeconds);
        }
      }, 1000);
    } else stopApp();
  })
);
module.exports = { server, config };
