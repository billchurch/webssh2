const path = require("path")
const fs = require("fs")
const readConfig = require("read-config-ng")
const Ajv = require("ajv")
const { deepMerge, generateSecureSecret } = require("./utils")
const { createNamespacedDebug } = require("./logger")
const { ConfigError, handleError } = require("./errors")
const { DEFAULTS } = require("./constants")

const debug = createNamespacedDebug("config")

const defaultConfig = {
  listen: {
    ip: "0.0.0.0",
    port: DEFAULTS.LISTEN_PORT
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
    port: DEFAULTS.SSH_PORT,
    term: DEFAULTS.SSH_TERM,
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
    allowReauth: true,
    allowReconnect: true,
    allowReplay: true
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
    secret: process.env.WEBSSH_SESSION_SECRET || generateSecureSecret(),
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
  required: ["listen", "http", "user", "ssh", "header", "options", "algorithms"]
}

function getConfigPath() {
  const nodeRoot = path.dirname(require.main.filename)
  return path.join(nodeRoot, "config.json")
}

function validateConfig(config) {
  const ajv = new Ajv()
  const validate = ajv.compile(configSchema)
  const valid = validate(config)
  if (!valid) {
    throw new Error(
      `Config validation error: ${ajv.errorsText(validate.errors)}`
    )
  }
  return config
}

function loadConfig() {
  const configPath = getConfigPath()

  try {
    if (fs.existsSync(configPath)) {
      const providedConfig = readConfig.sync(configPath)
      const mergedConfig = deepMerge(
        JSON.parse(JSON.stringify(defaultConfig)),
        providedConfig
      )

      if (process.env.PORT) {
        mergedConfig.listen.port = parseInt(process.env.PORT, 10)
        debug("Using PORT from environment: %s", mergedConfig.listen.port)
      }

      const validatedConfig = validateConfig(mergedConfig)
      debug("Merged and validated configuration")
      return validatedConfig
    }
    debug("Missing config.json for webssh. Using default config")
    return defaultConfig
  } catch (err) {
    const error = new ConfigError(
      `Problem loading config.json for webssh: ${err.message}`
    )
    handleError(error)
    return defaultConfig
  }
}

/**
 * Configuration for the application.
 *
 * @returns {Object} config
 * @property {Object} listen - Configuration for listening IP and port.
 * @property {string} listen.ip - The IP address to listen on.
 * @property {number} listen.port - The port number to listen on.
 * @property {Object} http - Configuration for HTTP settings.
 * @property {string[]} http.origins - The allowed origins for HTTP requests.
 * @property {Object} user - Configuration for user settings.
 * @property {string|null} user.name - The name of the user.
 * @property {string|null} user.password - The password of the user.
 * @property {Object} ssh - Configuration for SSH settings.
 * @property {string|null} ssh.host - The SSH host.
 * @property {number} ssh.port - The SSH port.
 * @property {string} ssh.term - The SSH terminal type.
 * @property {number} ssh.readyTimeout - The SSH ready timeout.
 * @property {number} ssh.keepaliveInterval - The SSH keepalive interval.
 * @property {number} ssh.keepaliveCountMax - The SSH keepalive count maximum.
 * @property {Object} header - Configuration for header settings.
 * @property {string|null} header.text - The header text.
 * @property {string} header.background - The header background color.
 * @property {Object} options - Configuration for options settings.
 * @property {boolean} options.challengeButton - Whether to show the challenge button.
 * @property {boolean} options.autoLog - Whether to automatically log.
 * @property {boolean} options.allowReauth - Whether to allow reauthentication.
 * @property {boolean} options.allowReconnect - Whether to allow reconnection.
 * @property {boolean} options.allowReplay - Whether to allow replay.
 * @property {Object} algorithms - Configuration for algorithms settings.
 * @property {string[]} algorithms.kex - The key exchange algorithms.
 * @property {string[]} algorithms.cipher - The cipher algorithms.
 * @property {string[]} algorithms.hmac - The HMAC algorithms.
 * @property {string[]} algorithms.compress - The compression algorithms.
 * @property {Object} session - Configuration for session settings.
 * @property {string} session.secret - The session secret.
 * @property {string} session.name - The session name.
 */
const config = loadConfig()

function getCorsConfig() {
  return {
    origin: config.http.origins,
    methods: ["GET", "POST"],
    credentials: true
  }
}

// Extend the config object with the getCorsConfig function
config.getCorsConfig = getCorsConfig

module.exports = config
