// app.js

// eslint-disable-next-line import/order
const config = require('./config');
const path = require('path');
const debug = require('debug')('WebSSH2');

require('colors');
// allow for color property extensions in log messages
const nodeRoot = path.dirname(require.main.filename);
const publicPath = path.join(nodeRoot, 'client', 'public');
const express = require('express');
const logger = require('morgan');
const passport = require('passport');
const { BasicStrategy } = require('passport-http');
const CustomStrategy = require('passport-custom').Strategy;
const LocalStrategy = require('passport-local').Strategy;

const app = express();
const server = require('http').Server(app);
const favicon = require('serve-favicon');
const io = require('socket.io')(server, {
  serveClient: false,
  path: '/ssh/socket.io',
  origins: config.http.origins,
});
const session = require('express-session')(config.session);
const { setupSession } = require('./setupSession');
const appSocket = require('./socket');
const expressOptions = require('./expressOptions');
const safeShutdown = require('./safeShutdown');

// Static credentials strategy
// when config.user.overridebasic is true, those credentials
// are used instead of HTTP basic auth.
passport.use(
  'overridebasic',
  new CustomStrategy((req, done) => {
    if (config.user.overridebasic) {
      const user = {
        username: config.user.name,
        password: config.user.password,
        privatekey: config.user.privatekey,
      };
      return done(null, user);
    }
    return done(null, false);
  })
);

// Basic auth strategy
passport.use(
  new BasicStrategy((username, password, done) => {
    const user = {
      username,
      password,
    };
    debug(
      `myAuth.name: ${username.yellow.bold.underline} and password ${
        password ? 'exists'.yellow.bold.underline : 'is blank'.underline.red.bold
      }`
    );
    return done(null, user);
  })
);

// Local auth strategy
// for taking credentials from GET/POST
passport.use(
  new LocalStrategy((username, password, done) => {
    const user = {
      username,
      password,
    };
    debug(
      `myAuth.name: ${username.yellow.bold.underline} and password ${
        password ? 'exists'.yellow.bold.underline : 'is blank'.underline.red.bold
      }`
    );
    return done(null, user);
  })
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = { server, config };
// express
app.use(safeShutdown.safeShutdownGuard);
app.use(session);
app.use(passport.initialize());
app.use(passport.session());
if (config.accesslog) app.use(logger('common'));
app.disable('x-powered-by');

// static files
app.use('/ssh', express.static(publicPath, expressOptions));

// favicon from root if being pre-fetched by browser to prevent a 404
app.use(favicon(path.join(publicPath, 'favicon.ico')));

// this is currently broken due to the way passport works with Basic Auth...
// maybe this should never have worked in the first place
app.get('/ssh/reauth', (req, res) => {
  const r = req.headers.referer || '/';
  req.logout();
  req.session.destroy();
  res
    .status(401)
    .send(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${r}"></head><body bgcolor="#000"></body></html>`
    );
});

// This route allows for collection of credentials from POST/GET
app.get(
  '/ssh/login/host/:host?',
  passport.authenticate(['overridebasic', 'local'], { session: true }),
  (req, res) => {
    setupSession(req, config);
    res.sendFile(path.join(path.join(publicPath, 'client.htm')));
  }
);

// This route allows for collection of credentials from HTTP Basic
app.get(
  '/ssh/host/:host?',
  passport.authenticate(['overridebasic', 'basic'], { session: true }),
  (req, res) => {
    setupSession(req, config);
    res.sendFile(path.join(path.join(publicPath, 'client.htm')));
  }
);

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
  socket.request.res ? session(socket.request, socket.request.res, next) : next(next);
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    if (io.of('/').sockets.size <= 1 && safeShutdown.shutdownMode) {
      safeShutdown.stopApp(io, server, 'All clients disconnected');
    }
  });
});

// trap SIGTERM and SIGINT (CTRL-C) and handle shutdown gracefully
const signals = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => process.on(signal, () => safeShutdown.doShutdown(io, server, config)));
