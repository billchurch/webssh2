// server
// app/config.js

const path = require("path")
const fs = require("fs")
const readConfig = require("read-config-ng")
const { deepMerge, validateConfig } = require("./utils")
const { generateSecureSecret } = require("./crypto-utils")
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
    keepaliveCountMax: 10,
    alwaysSendKeyboardInteractivePrompts: false,
    algorithms: {
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
      compress: ["none", "zlib@openssh.com", "zlib"],
      hmac: ["hmac-sha2-256", "hmac-sha2-512", "hmac-sha1"],
      kex: [
        "ecdh-sha2-nistp256",
        "ecdh-sha2-nistp384",
        "ecdh-sha2-nistp521",
        "diffie-hellman-group-exchange-sha256",
        "diffie-hellman-group14-sha1"
      ],
      serverHostKey: [
        "ecdsa-sha2-nistp256",
        "ecdsa-sha2-nistp384",
        "ecdsa-sha2-nistp521",
        "ssh-rsa"
      ]
    }
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
  session: {
    secret: process.env.WEBSSH_SESSION_SECRET || generateSecureSecret(),
    name: "webssh2.sid"
  }
}

function getConfigPath() {
  const nodeRoot = path.dirname(require.main.filename)
  return path.join(nodeRoot, "config.json")
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
 * Loads and validates the WebSSH2 configuration.
 * Merges the default configuration with user-provided config.json if it exists.
 * Falls back to default configuration if config.json is missing or invalid.
 * Overrides listen.port with PORT environment variable if provided.
 * 
 * @returns {Object} Configuration object with the following structure:
 * @returns {Object} .listen - Server listening settings
 * @returns {string} .listen.ip - IP address to listen on (default: "0.0.0.0")
 * @returns {number} .listen.port - Port number to listen on
 * @returns {Object} .http - HTTP server settings
 * @returns {string[]} .http.origins - Allowed CORS origins (default: ["*:*"])
 * @returns {Object} .user - Default user credentials
 * @returns {string|null} .user.name - Default username
 * @returns {string|null} .user.password - Default password
 * @returns {Object} .ssh - SSH connection settings
 * @returns {string|null} .ssh.host - SSH server hostname
 * @returns {number} .ssh.port - SSH server port
 * @returns {string} .ssh.term - Terminal type
 * @returns {number} .ssh.readyTimeout - Connection timeout in ms
 * @returns {number} .ssh.keepaliveInterval - Keepalive interval in ms
 * @returns {number} .ssh.keepaliveCountMax - Max keepalive count
 * @returns {boolean} .ssh.alwaysSendKeyboardInteractivePrompts - Force keyboard-interactive
 * @returns {Object} .ssh.algorithms - Supported SSH algorithms
 * @returns {string[]} .ssh.algorithms.cipher - Supported ciphers
 * @returns {string[]} .ssh.algorithms.compress - Supported compression
 * @returns {string[]} .ssh.algorithms.hmac - Supported HMAC algorithms
 * @returns {string[]} .ssh.algorithms.kex - Supported key exchange
 * @returns {string[]} .ssh.algorithms.serverHostKey - Supported host key types
 * @returns {Object} .header - UI header settings
 * @returns {string|null} .header.text - Header text
 * @returns {string} .header.background - Header background color
 * @returns {Object} .options - Feature flags and options
 * @returns {boolean} .options.challengeButton - Show challenge button
 * @returns {boolean} .options.autoLog - Enable automatic logging
 * @returns {boolean} .options.allowReauth - Allow reauthentication
 * @returns {boolean} .options.allowReconnect - Allow reconnection
 * @returns {boolean} .options.allowReplay - Allow session replay
 * @returns {Object} .session - Session configuration
 * @returns {string} .session.secret - Session secret key
 * @returns {string} .session.name - Session cookie name
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
