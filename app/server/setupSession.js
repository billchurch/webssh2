// setupSession.js

const validator = require('validator');
const myutil = require('./util');

// private
// capture, assign, and validate variables for later use
exports.setupSession = function setupSession(req, config) {
  req.session.username = req.user.username;
  req.session.userpassword = req.user.password;
  req.session.ssh = {
    host:
      config.ssh.host ||
      (validator.isIP(`${req.params.host}`) && req.params.host) ||
      (validator.isFQDN(req.params.host) && req.params.host) ||
      (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.params.host) && req.params.host),
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
};
