/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }],
   no-console: ["error", { allow: ["warn", "error", "info"] }] */
const path = require('path');
const crypto = require('crypto');

const nodeRoot = path.dirname(require.main.filename);

// establish defaults
const configDefault = {
  listen: {
    ip: '0.0.0.0',
    port: 2222,
  },
};

const config = configDefault;

if (process.env.LISTEN) config.listen.ip = process.env.LISTEN;

if (process.env.PORT) config.listen.port = process.env.PORT;

if (process.env.SOCKETIO_ORIGINS) config.socketio.origins = process.env.SOCKETIO_ORIGINS;

if (process.env.SOCKETIO_PATH) config.socketio.path = process.env.SOCKETIO_PATH;

module.exports = config;
