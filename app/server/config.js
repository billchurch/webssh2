/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }],
   no-console: ["error", { allow: ["warn", "error"] }] */
const fs = require('fs');
const path = require('path');

const nodeRoot = path.dirname(require.main.filename);
const configPath = path.join(nodeRoot, 'config.json');

// sane defaults if config.json or parts are missing
let config = {
  listen: {
    ip: '0.0.0.0',
    port: 2222,
  },
  http: {
    origins: ['localhost:2222'],
  },
  user: {
    name: null,
    password: null,
    privatekey: null,
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
  session: {
    name: 'WebSSH2',
    secret: 'mysecret',
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
  if (fs.existsSync(configPath)) {
    // eslint-disable-next-line no-console
    console.info(`WebSSH2 service reading config from: ${configPath}`);
    // eslint-disable-next-line global-require
    config = require('read-config-ng')(configPath);
  } else {
    console.error(
      `\n\nERROR: Missing config.json for WebSSH2. Current config: ${JSON.stringify(config)}`
    );
    console.error('\n  See config.json.sample for details\n\n');
  }
} catch (err) {
  console.error(
    `\n\nERROR: Missing config.json for WebSSH2. Current config: ${JSON.stringify(config)}`
  );
  console.error('\n  See config.json.sample for details\n\n');
  console.error(`ERROR:\n\n  ${err}`);
}

module.exports = config;
