'use strict'

const path = require('path')
const fs = require('fs')
const readConfig = require('read-config-ng')
const Ajv = require('ajv')

/**
 * @typedef {Object} Config
 * @property {Object} listen - Listening configuration
 * @property {string} listen.ip - IP address to listen on
 * @property {number} listen.port - Port to listen on
 * @property {Object} http - HTTP configuration
 * @property {string[]} http.origins - Allowed origins
 * @property {Object} user - User configuration
 * @property {string|null} user.name - Username
 * @property {string|null} user.password - Password
 * @property {Object} ssh - SSH configuration
 * @property {string|null} ssh.host - SSH host
 * @property {number} ssh.port - SSH port
 * @property {string} ssh.term - Terminal type
 * @property {number} ssh.readyTimeout - Ready timeout
 * @property {number} ssh.keepaliveInterval - Keepalive interval
 * @property {number} ssh.keepaliveCountMax - Max keepalive count
 * @property {Object} terminal - Terminal configuration
 * @property {boolean} terminal.cursorBlink - Whether cursor blinks
 * @property {number} terminal.scrollback - Scrollback limit
 * @property {number} terminal.tabStopWidth - Tab stop width
 * @property {string} terminal.bellStyle - Bell style
 * @property {Object} header - Header configuration
 * @property {string|null} header.text - Header text
 * @property {string} header.background - Header background color
 * @property {Object} options - Options configuration
 * @property {boolean} options.challengeButton - Challenge button enabled
 * @property {boolean} options.allowreauth - Allow reauthentication
 * @property {Object} algorithms - Encryption algorithms
 * @property {string[]} algorithms.kex - Key exchange algorithms
 * @property {string[]} algorithms.cipher - Cipher algorithms
 * @property {string[]} algorithms.hmac - HMAC algorithms
 * @property {string[]} algorithms.compress - Compression algorithms
 * @property {Object} serverlog - Server log configuration
 * @property {boolean} serverlog.client - Client logging enabled
 * @property {boolean} serverlog.server - Server logging enabled
 * @property {boolean} accesslog - Access logging enabled
 * @property {boolean} verify - Verification enabled
 */

/**
 * Default configuration
 * @type {Config}
 */
const defaultConfig = {
  listen: {
    ip: '0.0.0.0',
    port: 2222
  },
  http: {
    origins: ['*:*']
  },
  user: {
    name: null,
    password: null
  },
  ssh: {
    host: null,
    port: 22,
    term: 'xterm-color',
    readyTimeout: 20000,
    keepaliveInterval: 120000,
    keepaliveCountMax: 10
  },
  terminal: {
    cursorBlink: true,
    scrollback: 10000,
    tabStopWidth: 8,
    bellStyle: 'sound'
  },
  header: {
    text: null,
    background: 'green'
  },
  options: {
    challengeButton: true,
    allowreauth: false,
    allowReplay: false
  },
  algorithms: {
    kex: [
      'ecdh-sha2-nistp256',
      'ecdh-sha2-nistp384',
      'ecdh-sha2-nistp521',
      'diffie-hellman-group-exchange-sha256',
      'diffie-hellman-group14-sha1'
    ],
    cipher: [
      'aes128-ctr',
      'aes192-ctr',
      'aes256-ctr',
      'aes128-gcm',
      'aes128-gcm@openssh.com',
      'aes256-gcm',
      'aes256-gcm@openssh.com',
      'aes256-cbc'
    ],
    hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
    compress: ['none', 'zlib@openssh.com', 'zlib']
  },
  serverlog: {
    client: false,
    server: false
  },
  accesslog: false,
  verify: false
}

/**
 * Schema for validating the config
 */
const configSchema = {
  type: 'object',
  properties: {
    listen: {
      type: 'object',
      properties: {
        ip: { type: 'string', format: 'ipv4' },
        port: { type: 'integer', minimum: 1, maximum: 65535 }
      },
      required: ['ip', 'port']
    },
    http: {
      type: 'object',
      properties: {
        origins: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['origins']
    },
    user: {
      type: 'object',
      properties: {
        name: { type: ['string', 'null'] },
        password: { type: ['string', 'null'] }
      },
      required: ['name', 'password']
    },
    ssh: {
      type: 'object',
      properties: {
        host: { type: ['string', 'null'] },
        port: { type: 'integer', minimum: 1, maximum: 65535 },
        term: { type: 'string' },
        readyTimeout: { type: 'integer' },
        keepaliveInterval: { type: 'integer' },
        keepaliveCountMax: { type: 'integer' }
      },
      required: ['host', 'port', 'term', 'readyTimeout', 'keepaliveInterval', 'keepaliveCountMax']
    },
    terminal: {
      type: 'object',
      properties: {
        cursorBlink: { type: 'boolean' },
        scrollback: { type: 'integer' },
        tabStopWidth: { type: 'integer' },
        bellStyle: { type: 'string' }
      },
      required: ['cursorBlink', 'scrollback', 'tabStopWidth', 'bellStyle']
    },
    header: {
      type: 'object',
      properties: {
        text: { type: ['string', 'null'] },
        background: { type: 'string' }
      },
      required: ['text', 'background']
    },
    options: {
      type: 'object',
      properties: {
        challengeButton: { type: 'boolean' },
        allowreauth: { type: 'boolean' },
        allowReplay: { type: 'boolean' }
      },
      required: ['challengeButton', 'allowreauth', 'allowReplay']
    },
    algorithms: {
      type: 'object',
      properties: {
        kex: {
          type: 'array',
          items: { type: 'string' }
        },
        cipher: {
          type: 'array',
          items: { type: 'string' }
        },
        hmac: {
          type: 'array',
          items: { type: 'string' }
        },
        compress: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['kex', 'cipher', 'hmac', 'compress']
    },
    serverlog: {
      type: 'object',
      properties: {
        client: { type: 'boolean' },
        server: { type: 'boolean' }
      },
      required: ['client', 'server']
    },
    accesslog: { type: 'boolean' },
    verify: { type: 'boolean' }
  },
  required: ['listen', 'http', 'user', 'ssh', 'terminal', 'header', 'options', 'algorithms', 'serverlog', 'accesslog', 'verify']
}

/**
 * Gets the path to the config file
 * @returns {string} The path to the config file
 */
function getConfigPath() {
  const nodeRoot = path.dirname(require.main.filename)
  return path.join(nodeRoot, 'config.json')
}

/**
 * Reads the config file
 * @param {string} configPath - The path to the config file
 * @returns {Config} The configuration object
 */
function readConfigFile(configPath) {
  console.log('WebSSH2 service reading config from: ' + configPath)
  return readConfig(configPath)
}

/**
 * Validates the configuration against the schema
 * @param {Object} config - The configuration object to validate
 * @returns {Object} The validated configuration object
 * @throws {Error} If the configuration is invalid
 */
function validateConfig(config) {
  const ajv = new Ajv()
  const validate = ajv.compile(configSchema)
  const valid = validate(config)
  console.log('WebSSH2 service validating config')
  if (!valid) {
    throw new Error('Config validation error: ' + ajv.errorsText(validate.errors))
  }
  console.log("config: ", JSON.stringify(config, null, 2))
  return config
}

/**
 * Logs an error message
 * @param {string} message - The error message
 * @param {Error} [error] - The error object
 */
function logError(message, error) {
  console.error(message)
  if (error) {
    console.error('ERROR:\n\n  ' + error)
  }
}

/**
 * Loads the configuration
 * @returns {Config} The loaded configuration
 */
function loadConfig() {
  const configPath = getConfigPath()

  try {
    if (fs.existsSync(configPath)) {
      const config = readConfigFile(configPath)
      return validateConfig(config)
    } else {
      logError(
        '\n\nERROR: Missing config.json for webssh. Current config: ' +
          JSON.stringify(defaultConfig) +
          '\n\n  See config.json.sample for details\n\n'
      )
      return defaultConfig
    }
  } catch (err) {
    logError(
      '\n\nERROR: Missing config.json for webssh. Current config: ' +
        JSON.stringify(defaultConfig) +
        '\n\n  See config.json.sample for details\n\n',
      err
    )
    return defaultConfig
  }
}

/**
 * The loaded configuration
 * @type {Config}
 */
const config = loadConfig()

module.exports = config
