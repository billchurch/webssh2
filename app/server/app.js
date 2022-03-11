/* jshint esversion: 6, asi: true, node: true */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }],
   no-console: ["error", { allow: ["warn", "error"] }] */
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
const validator = require('validator');
const favicon = require('serve-favicon');
const io = require('socket.io')(server, {
  serveClient: false,
  path: '/ssh/socket.io',
  origins: config.http.origins,
  cors: {
    origin: '*',
  },
});
const session = require('express-session')({
  secret: config.session.secret,
  name: config.session.name,
  resave: true,
  saveUninitialized: false,
  unset: 'destroy',
});
const appSocket = require('./socket');
const expressOptions = require('./expressOptions');
const myutil = require('./util');

myutil.setDefaultCredentials(
  config.user.name,
  config.user.password,
  config.user.privatekey,
  config.user.overridebasic
);

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
// clean stop
function stopApp(reason) {
  shutdownMode = false;
  // eslint-disable-next-line no-console
  if (reason) console.log(`Stopping: ${reason}`);
  if (shutdownInterval) clearInterval(shutdownInterval);
  io.close();
  server.close();
}

module.exports = { server, config };
// express
app.use(safeShutdownGuard);
app.use(session);
app.use(myutil.basicAuth);
if (config.accesslog) app.use(logger('common'));
app.disable('x-powered-by');

// static files
app.use('/ssh', express.static(publicPath, expressOptions));

// favicon from root if being pre-fetched by browser to prevent a 404
app.use(favicon(path.join(publicPath, 'favicon.ico')));

app.get('/ssh/reauth', (req, res) => {
  const r = req.headers.referer || '/';
  res
    .status(401)
    .send(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${r}"></head><body bgcolor="#000"></body></html>`
    );
});

// eslint-disable-next-line complexity
app.get('/ssh/host/:host/:container_id', (req, res) => {
  if (!req.params.container_id) {
    throw new Error('Container id is not provided');
  }
  console.log({ params: req.params });
  res.sendFile(path.join(path.join(publicPath, 'client.htm')));
  // capture, assign, and validate variables
  req.session.ssh = {
    host:
      config.ssh.host ||
      (validator.isIP(`${req.params.host}`) && req.params.host) ||
      (validator.isFQDN(req.params.host) && req.params.host) ||
      (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.params.host) && req.params.host),
    container_id: req.params.container_id,
    port:
      (validator.isInt(`${req.query.port}`, { min: 1, max: 65535 }) && req.query.port) ||
      config.ssh.port,
    localAddress: config.ssh.localAddress,
    localPort: config.ssh.localPort,
    header: {
      name: req.query.header || config.header.text,
      background: req.query.headerBackground || config.header.background,
    },
    algorithms: config.algorithms,
    keepaliveInterval: config.ssh.keepaliveInterval,
    keepaliveCountMax: config.ssh.keepaliveCountMax,
    allowedSubnets: config.ssh.allowedSubnets,
    term:
      (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.query.sshterm) && req.query.sshterm) ||
      config.ssh.term,
    terminal: {
      cursorBlink: validator.isBoolean(`${req.query.cursorBlink}`)
        ? myutil.parseBool(req.query.cursorBlink)
        : config.terminal.cursorBlink,
      scrollback:
        validator.isInt(`${req.query.scrollback}`, { min: 1, max: 200000 }) && req.query.scrollback
          ? req.query.scrollback
          : config.terminal.scrollback,
      tabStopWidth:
        validator.isInt(`${req.query.tabStopWidth}`, { min: 1, max: 100 }) && req.query.tabStopWidth
          ? req.query.tabStopWidth
          : config.terminal.tabStopWidth,
      bellStyle:
        req.query.bellStyle && ['sound', 'none'].indexOf(req.query.bellStyle) > -1
          ? req.query.bellStyle
          : config.terminal.bellStyle,
    },
    allowreplay:
      config.options.challengeButton ||
      (validator.isBoolean(`${req.headers.allowreplay}`)
        ? myutil.parseBool(req.headers.allowreplay)
        : false),
    allowreauth: config.options.allowreauth || false,
    mrhsession:
      validator.isAlphanumeric(`${req.headers.mrhsession}`) && req.headers.mrhsession
        ? req.headers.mrhsession
        : 'none',
    serverlog: {
      client: config.serverlog.client || false,
      server: config.serverlog.server || false,
    },
    readyTimeout:
      (validator.isInt(`${req.query.readyTimeout}`, { min: 1, max: 300000 }) &&
        req.query.readyTimeout) ||
      config.ssh.readyTimeout,
  };
  if (req.session.ssh.header.name) validator.escape(req.session.ssh.header.name);
  if (req.session.ssh.header.background) validator.escape(req.session.ssh.header.background);
});

// express error handling
app.use((req, res) => {
  res.status(404).send("Sorry, can't find that!");
});

app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

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
