/* eslint-disable no-console */
// ssh.js
const validator = require('validator');
const path = require('path');

const nodeRoot = path.dirname(require.main.filename);

const publicPath = path.join(nodeRoot, 'client', 'public');
const { parseBool } = require('./util');
const config = require('./config');

// exports.reauth = function reauth(req, res) {
//   let { referer } = req.headers;
//   if (!validator.isURL(referer, { host_whitelist: ['localhost'] })) {
//     console.error(
//       `WebSSH2 (${req.sessionID}) ERROR: Referrer '${referer}' for '/reauth' invalid. Setting to '/' which will probably fail.`,
//     );
//     referer = '/';
//   }
//   res
//     .status(401)
//     .send(
//       `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${referer}"></head><body bgcolor="#000"></body></html>`,
//     );
// };

exports.connect = function connect(req, res) {
  res.sendFile(path.join(path.join(publicPath, 'client.htm')));

  // let { host, port } = config.ssh;
  // let { text: header, background: headerBackground } = config.header;
  // let { term: sshterm, readyTimeout } = config.ssh;
  // let {
  //   cursorBlink,
  //   scrollback,
  //   tabStopWidth,
  //   bellStyle,
  //   fontSize,
  //   fontFamily,
  //   letterSpacing,
  //   lineHeight,
  // } = config.terminal;

  // capture, assign, and validate variables

  // if (req.params?.host) {
  //   if (
  //     validator.isIP(`${req.params.host}`) ||
  //     validator.isFQDN(req.params.host) ||
  //     /^(([a-z]|[A-Z]|\d|[!^(){}\-_~])+)?\w$/.test(req.params.host)
  //   ) {
  //     host = req.params.host;
  //   }
  // }

  // //// ADding exta
  // if (req.params?.devboxID) {
  //   devboxID = req.params.devboxID;
  // }
  // if (req.params?.supabaseAuth) {
  //   supaBaseAuth = req.params.supaBaseAuth;
  // }

  //   req.session.ssh = {
  //     host,
  //     port,
  //     localAddress: config.ssh.localAddress,
  //     localPort: config.ssh.localPort,
  //     header: {
  //       name: header,
  //       background: headerBackground,
  //     },
  //     algorithms: config.algorithms,
  //     keepaliveInterval: config.ssh.keepaliveInterval,
  //     keepaliveCountMax: config.ssh.keepaliveCountMax,
  //     allowedSubnets: config.ssh.allowedSubnets,
  //     term: sshterm,
  //     terminal: {
  //       cursorBlink,
  //       scrollback,
  //       tabStopWidth,
  //       bellStyle,
  //       fontSize,
  //       fontFamily,
  //       letterSpacing,
  //       lineHeight,
  //     },
  //     cols: null,
  //     rows: null,
  //     allowreplay:
  //       config.options.challengeButton ||
  //       (validator.isBoolean(`${req.headers.allowreplay}`)
  //         ? parseBool(req.headers.allowreplay)
  //         : false),
  //     allowreauth: config.options.allowreauth || false,
  //     mrhsession:
  //       validator.isAlphanumeric(`${req.headers.mrhsession}`) && req.headers.mrhsession
  //         ? req.headers.mrhsession
  //         : 'none',
  //     serverlog: {
  //       client: config.serverlog.client || false,
  //       server: config.serverlog.server || false,
  //     },
  //     readyTimeout,
  //   };
  //   if (req.session.ssh.header.name) validator.escape(req.session.ssh.header.name);
  //   if (req.session.ssh.header.background) validator.escape(req.session.ssh.header.background);
  // };

  // exports.notfound = function notfound(_req, res) {
  //   res.status(404).send("Sorry, can't find that!");
  // };

  // exports.handleErrors = function handleErrors(err, _req, res) {
  //   console.error(err.stack);
  //   res.status(500).send('Something broke!');
  // };
};
