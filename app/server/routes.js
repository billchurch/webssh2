/* eslint-disable no-console */
// ssh.js
const validator = require('validator');
const path = require('path');

const nodeRoot = path.dirname(require.main.filename);

const publicPath = path.join(nodeRoot, 'client', 'public');
const { parseBool } = require('./util');
const config = require('./config');
const { query } = require('express');

exports.reauth = function reauth(req, res) {
  let { referer } = req.headers;
  if (!validator.isURL(referer, { host_whitelist: ['localhost'] })) {
    console.error(
      `WebSSH2 (${req.sessionID}) ERROR: Referrer '${referer}' for '/reauth' invalid. Setting to '/' which will probably fail.`
    );
    referer = '/';
  }
  res
    .status(401)
    .send(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${referer}"></head><body bgcolor="#000"></body></html>`
    );
};

exports.connect = function connect(req, res) {
  res.sendFile(path.join(path.join(publicPath, 'client.htm')));

  let { host, port } = config.ssh;
  let { text: header, background: headerBackground } = config.header;
  let { term: sshterm, readyTimeout } = config.ssh;
  let { cursorBlink, scrollback, tabStopWidth, bellStyle } = config.terminal;

  // capture, assign, and validate variables

  if (req.params?.host) {
    if (
      validator.isIP(`${req.params.host}`) ||
      validator.isFQDN(req.params.host) ||
      /^(([a-z]|[A-Z]|\d|[!^(){}\-_~])+)?\w$/.test(req.params.host)
    ) {
      host = req.params.host;
    }
  }

  if (req.method === 'POST' && req.body?.username && req.body?.userpassword) {
    req.session.username = req.body.username;
    req.session.userpassword = req.body.userpassword;

    if (req.body?.port && validator.isInt(`${req.body.port}`, { min: 1, max: 65535 }))
      port = req.body.port;
    if (req.body?.header) header = req.body.header;
    if (req.body?.headerBackground) {
      headerBackground = req.body.headerBackground;
      console.log(`background: ${req.body.headerBackground}`);
    };
    if (req.body?.sshterm && /^(([a-z]|[A-Z]|\d|[!^(){}\-_~])+)?\w$/.test(req.body.sshterm))
      sshterm = req.body.sshterm;
    if (req.body?.cursorBlink && validator.isBoolean(`${req.body.cursorBlink}`)) cursorBlink = parseBool(req.body.cursorBlink);
    if (req.body?.scrollback && validator.isInt(`${req.body.scrollback}`, { min: 1, max: 200000 }))
      scrollback = req.body.scrollback;    if (req.body?.tabStopWidth) tabStopWidth = req.body.tabStopWidth;
    if (req.body?.tabStopWidth && validator.isInt(`${req.body.tabStopWidth}`, { min: 1, max: 100 }))
      tabStopWidth = req.body.tabStopWidth;
    if (req.body?.bellStyle && ['sound', 'none'].indexOf(req.body.bellStyle) > -1)
      bellStyle = req.body.bellStyle;
    if (
      req.body?.readyTimeout &&
      validator.isInt(`${req.body.readyTimeout}`, { min: 1, max: 300000 })
    )
      readyTimeout = req.body.readyTimeout;
  }

  if (req.method === 'GET') {
    if (req.query?.port && validator.isInt(`${req.query.port}`, { min: 1, max: 65535 }))
      port = req.query.port;
    if (req.query?.header) header = req.query.header;
    if (req.query?.headerBackground) headerBackground = req.query.headerBackground;
    if (req.query?.sshterm && /^(([a-z]|[A-Z]|\d|[!^(){}\-_~])+)?\w$/.test(req.query.sshterm))
      sshterm = req.query.sshterm;
    if (req.query?.cursorBlink && validator.isBoolean(`${req.query.cursorBlink}`))
      cursorBlink = parseBool(req.query.cursorBlink);
    if (
      req.query?.scrollback &&
      validator.isInt(`${req.query.scrollback}`, { min: 1, max: 200000 })
    )
      scrollback = req.query.scrollback;
    if (
      req.query?.tabStopWidth &&
      validator.isInt(`${req.query.tabStopWidth}`, { min: 1, max: 100 })
    )
      tabStopWidth = req.query.tabStopWidth;
    if (req.query?.bellStyle && ['sound', 'none'].indexOf(req.query.bellStyle) > -1)
      bellStyle = req.query.bellStyle;
    if (
      req.query?.readyTimeout &&
      validator.isInt(`${req.query.readyTimeout}`, { min: 1, max: 300000 })
    )
      readyTimeout = req.query.readyTimeout;
  }

  req.session.ssh = {
    host,
    port,
    localAddress: config.ssh.localAddress,
    localPort: config.ssh.localPort,
    header: {
      name: header,
      background: headerBackground,
    },
    algorithms: config.algorithms,
    keepaliveInterval: config.ssh.keepaliveInterval,
    keepaliveCountMax: config.ssh.keepaliveCountMax,
    allowedSubnets: config.ssh.allowedSubnets,
    term: sshterm,
    terminal: {
      cursorBlink,
      scrollback,
      tabStopWidth,
      bellStyle,
    },
    allowreplay:
      config.options.challengeButton ||
      (validator.isBoolean(`${req.headers.allowreplay}`)
        ? parseBool(req.headers.allowreplay)
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
    readyTimeout,
  };
  if (req.session.ssh.header.name) validator.escape(req.session.ssh.header.name);
  if (req.session.ssh.header.background) validator.escape(req.session.ssh.header.background);
};

exports.notfound = function notfound(_req, res) {
  res.status(404).send("Sorry, can't find that!");
};

exports.handleErrors = function handleErrors(err, _req, res) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
};
