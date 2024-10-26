/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }],
   no-console: ["error", { allow: ["warn", "error", "info"] }] */
const fs = require('fs');
const path = require('path');
const debugWebSSH2 = require('debug')('WebSSH2');
const crypto = require('crypto');
const util = require('util');
const readconfig = require('read-config-ng');

const nodeRoot = path.dirname(require.main.filename);
const configPath = path.join(nodeRoot, 'config.json');

let myConfig;
// establish defaults
const configDefault = {
  listen: {
    ip: '0.0.0.0',
    port: 2222,
  },
  socketio: {
    serveClient: false,
    path: '/ssh/socket.io',
    origins: ['localhost:2222'],
  },
  express: {
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
  },
  user: {
    name: null,
    password: null,
    privateKey: null,
    overridebasic: false,
  },
  ssh: {
    host: null,
    port: 22,
    term: 'xterm-color',
    readyTimeout: 20000,
    keepaliveInterval: 120000,
    keepaliveCountMax: 10,
    allowedSubnets: [],
  },
  terminal: {
    cursorBlink: true,
    scrollback: 10000,
    tabStopWidth: 8,
    bellStyle: 'sound',
  },
  header: {
    text: null,
    background: 'green',
  },
  options: {
    challengeButton: true,
    allowreauth: true,
  },
  algorithms: {
    kex: [
      'ecdh-sha2-nistp256',
      'ecdh-sha2-nistp384',
      'ecdh-sha2-nistp521',
      'diffie-hellman-group-exchange-sha256',
      'diffie-hellman-group14-sha1',
    ],
    cipher: [
      'aes128-ctr',
      'aes192-ctr',
      'aes256-ctr',
      'aes128-gcm',
      'aes128-gcm@openssh.com',
      'aes256-gcm',
      'aes256-gcm@openssh.com',
      'aes256-cbc',
    ],
    hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
    compress: ['none', 'zlib@openssh.com', 'zlib'],
  },
  serverlog: {
    client: false,
    server: false,
  },
  accesslog: false,
  verify: false,
  safeShutdownDuration: 300,
};

// test if config.json exists, if not provide error message but try to run anyway
try {
  if (!fs.existsSync(configPath)) {
    console.error(
      `\n\nERROR: Missing config.json for WebSSH2. Current config: ${util.inspect(myConfig)}`
    );
    console.error('\n  See config.json.sample for details\n\n');
  }
  console.info(`WebSSH2 service reading config from: ${configPath}`);
  const configFile = readconfig(configPath, { override: true });
  // myConfig = merger.mergeObjects([configDefault, configFile]);
  myConfig = { ...configDefault, ...configFile };
  debugWebSSH2(`\nCurrent config: ${util.inspect(myConfig)}`);
} catch (err) {
  myConfig = configDefault;
  console.error(
    `\n\nERROR: Missing config.json for WebSSH2. Current config: ${util.inspect(myConfig)}`
  );
  console.error('\n  See config.json.sample for details\n\n');
  console.error(`ERROR:\n\n  ${err}`);
}
const config = myConfig;

if (process.env.LISTEN) config.listen.ip = process.env.LISTEN;

if (process.env.PORT) config.listen.port = process.env.PORT;

if (process.env.SOCKETIO_ORIGINS) config.socketio.origins = process.env.SOCKETIO_ORIGINS;

if (process.env.SOCKETIO_PATH) config.socketio.path = process.env.SOCKETIO_PATH;

if (process.env.SOCKETIO_SERVECLIENT)
  config.socketio.serveClient = process.env.SOCKETIO_SERVECLIENT;

module.exports = config;
