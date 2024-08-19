// server
// app/config.js
"use strict"

const path = require("path")
const fs = require("fs")
const readConfig = require("read-config-ng")
const Ajv = require("ajv")
const crypto = require("crypto")

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
 * @property {Object} header - Header configuration
 * @property {string|null} header.text - Header text
 * @property {string} header.background - Header background color
 * @property {Object} options - Options configuration
 * @property {boolean} options.challengeButton - Challenge button enabled
 * @property {boolean} options.autoLog - Auto log enabled
 * @property {boolean} options.allowReauth - Allow reauthentication
 * @property {boolean} options.allowReconnect - Allow reconnection
 * @property {boolean} options.allowReplay - Allow replay
 * @property {Object} algorithms - Encryption algorithms
 * @property {string[]} algorithms.kex - Key exchange algorithms
 * @property {string[]} algorithms.cipher - Cipher algorithms
 * @property {string[]} algorithms.hmac - HMAC algorithms
 * @property {string[]} algorithms.compress - Compression algorithms
 */

/**
 * Default configuration
 * @type {Config}
 */
const defaultConfig = {
  listen: {
    ip: "0.0.0.0",
    port: 2222
  },
  http: {
    origins: ["*:*"]
  },
  user: {
    name: null,
    password: null
  },
  ssh: {
    host: null,
    port: 22,
    term: "xterm-color",
    readyTimeout: 20000,
    keepaliveInterval: 120000,
    keepaliveCountMax: 10
  },
  header: {
    text: null,
    background: "green"
  },
  options: {
    challengeButton: true,
    autoLog: false,
    allowReauth: false,
    allowReconnect: false,
    allowReplay: false
  },
  algorithms: {
    kex: [
      "ecdh-sha2-nistp256",
      "ecdh-sha2-nistp384",
      "ecdh-sha2-nistp521",
      "diffie-hellman-group-exchange-sha256",
      "diffie-hellman-group14-sha1"
    ],
    cipher: [
      "aes128-ctr",
      "aes192-ctr",
      "aes256-ctr",
      "aes128-gcm",
      "aes128-gcm@openssh.com",
      "aes256-gcm",
      "aes256-gcm@openssh.com",
      "aes256-cbc"
    ],
    hmac: ["hmac-sha2-256", "hmac-sha2-512", "hmac-sha1"],
    compress: ["none", "zlib@openssh.com", "zlib"]
  },
  session: {
    secret: generateSecureSecret(),
    name: "webssh2.sid"
  }
}

/**
 * Schema for validating the config
 */
const configSchema = {
  type: "object",
  properties: {
    listen: {
      type: "object",
      properties: {
        ip: { type: "string", format: "ipv4" },
        port: { type: "integer", minimum: 1, maximum: 65535 }
      },
      required: ["ip", "port"]
    },
    http: {
      type: "object",
      properties: {
        origins: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["origins"]
    },
    user: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        password: { type: ["string", "null"] }
      },
      required: ["name", "password"]
    },
    ssh: {
      type: "object",
      properties: {
        host: { type: ["string", "null"] },
        port: { type: "integer", minimum: 1, maximum: 65535 },
        term: { type: "string" },
        readyTimeout: { type: "integer" },
        keepaliveInterval: { type: "integer" },
        keepaliveCountMax: { type: "integer" }
      },
      required: [
        "host",
        "port",
        "term",
        "readyTimeout",
        "keepaliveInterval",
        "keepaliveCountMax"
      ]
    },
    header: {
      type: "object",
      properties: {
        text: { type: ["string", "null"] },
        background: { type: "string" }
      },
      required: ["text", "background"]
    },
    options: {
      type: "object",
      properties: {
        challengeButton: { type: "boolean" },
        autoLog: { type: "boolean" },
        allowReauth: { type: "boolean" },
        allowReconnect: { type: "boolean" },
        allowReplay: { type: "boolean" }
      },
      required: ["challengeButton", "allowReauth", "allowReplay"]
    },
    algorithms: {
      type: "object",
      properties: {
        kex: {
          type: "array",
          items: { type: "string" }
        },
        cipher: {
          type: "array",
          items: { type: "string" }
        },
        hmac: {
          type: "array",
          items: { type: "string" }
        },
        compress: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["kex", "cipher", "hmac", "compress"]
    },
    session: {
      type: "object",
      properties: {
        secret: { type: "string" },
        name: { type: "string" }
      },
      required: ["secret", "name"]
    }
  },
  required: [
    "listen",
    "http",
    "user",
    "ssh",
    "header",
    "options",
    "algorithms"
  ]
}

/**
 * Gets the path to the config file
 * @returns {string} The path to the config file
 */
function getConfigPath() {
  const nodeRoot = path.dirname(require.main.filename)
  return path.join(nodeRoot, "config.json")
}

/**
 * Reads the config file synchronously
 * @param {string} configPath - The path to the config file
 * @returns {Object} The configuration object
 */
function readConfigFile(configPath) {
  console.log("WebSSH2 service reading config from: " + configPath)
  return readConfig.sync(configPath)
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
  console.log("WebSSH2 service validating config")
  if (!valid) {
    throw new Error(
      "Config validation error: " + ajv.errorsText(validate.errors)
    )
  }
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
    console.error("ERROR:\n\n  " + error)
  }
}

/**
 * Loads and merges the configuration synchronously
 * @returns {Object} The merged configuration
 */
function loadConfig() {
  const configPath = getConfigPath()

  try {
    if (fs.existsSync(configPath)) {
      const providedConfig = readConfigFile(configPath)

      // Deep merge the provided config with the default config
      const mergedConfig = deepMerge(
        JSON.parse(JSON.stringify(defaultConfig)),
        providedConfig
      )

      const validatedConfig = validateConfig(mergedConfig)
      console.log("Merged and validated configuration")
      return validatedConfig
    } else {
      logError(
        "\n\nERROR: Missing config.json for webssh. Using default config: " +
          JSON.stringify(defaultConfig) +
          "\n\n  See config.json.sample for details\n\n"
      )
      return defaultConfig
    }
  } catch (err) {
    logError(
      "\n\nERROR: Problem loading config.json for webssh. Using default config: " +
        JSON.stringify(defaultConfig) +
        "\n\n  See config.json.sample for details\n\n",
      err
    )
    return defaultConfig
  }
}

/**
 * Generates a secure random session secret
 * @returns {string} A random 32-byte hex string
 */
function generateSecureSecret() {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Deep merges two objects
 * @param {Object} target - The target object to merge into
 * @param {Object} source - The source object to merge from
 * @returns {Object} The merged object
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        target[key] = deepMerge(target[key] || {}, source[key])
      } else {
        target[key] = source[key]
      }
    }
  }
  return target
}

/**
 * The loaded configuration
 * @type {Object}
 */
const config = loadConfig()

module.exports = config
