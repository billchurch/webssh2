// server
// app/config.js

import path from 'path'
import { promises as fs } from 'fs'
import { deepMerge, validateConfig } from './utils.js'
import { generateSecureSecret } from './crypto-utils.js'
import { createNamespacedDebug } from './logger.js'
import { ConfigError, handleError } from './errors.js'
import { DEFAULTS } from './constants.js'

const debug = createNamespacedDebug('config')

const defaultConfig = {
  listen: {
    ip: '0.0.0.0',
    port: DEFAULTS.LISTEN_PORT,
  },
  http: {
    origins: ['*:*'],
  },
  user: {
    name: null,
    password: null,
    privateKey: null,
    passphrase: null,
  },
  ssh: {
    host: null,
    port: DEFAULTS.SSH_PORT,
    term: DEFAULTS.SSH_TERM,
    readyTimeout: 20000,
    keepaliveInterval: 120000,
    keepaliveCountMax: 10,
    alwaysSendKeyboardInteractivePrompts: false,
    disableInteractiveAuth: false,
    algorithms: {
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
      compress: ['none', 'zlib@openssh.com', 'zlib'],
      hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
      kex: [
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521',
        'diffie-hellman-group-exchange-sha256',
        'diffie-hellman-group14-sha1',
      ],
      serverHostKey: [
        'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521',
        'ssh-rsa',
      ],
    },
  },
  header: {
    text: null,
    background: 'green',
  },
  options: {
    challengeButton: true,
    autoLog: false,
    allowReauth: true,
    allowReconnect: true,
    allowReplay: true,
  },
  session: {
    secret: process.env.WEBSSH_SESSION_SECRET || generateSecureSecret(),
    name: 'webssh2.sid',
  },
}

import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function getConfigPath() {
  return path.join(__dirname, '..', 'config.json')
}

/**
 * Asynchronously loads configuration from config.json using read-config-ng async API
 * @returns {Promise<Object>} Configuration object
 */
async function loadConfigAsync() {
  const configPath = getConfigPath()

  try {
    // Check if config file exists using async fs.access
    await fs.access(configPath)

    // Use native Node.js JSON parsing instead of read-config-ng for async
    const data = await fs.readFile(configPath, 'utf8')
    const providedConfig = JSON.parse(data)
    const mergedConfig = deepMerge(JSON.parse(JSON.stringify(defaultConfig)), providedConfig)

    if (process.env.PORT) {
      mergedConfig.listen.port = parseInt(process.env.PORT, 10)
      debug('Using PORT from environment: %s', mergedConfig.listen.port)
    }

    const validatedConfig = validateConfig(mergedConfig)
    debug('Merged and validated configuration')
    return validatedConfig
  } catch (err) {
    if (err.code === 'ENOENT') {
      debug('Missing config.json for webssh. Using default config')
      const config = JSON.parse(JSON.stringify(defaultConfig))

      // Apply PORT environment variable to default config
      if (process.env.PORT) {
        config.listen.port = parseInt(process.env.PORT, 10)
        debug('Using PORT from environment: %s', config.listen.port)
      }

      return config
    }

    const error = new ConfigError(`Problem loading config.json for webssh: ${err.message}`)
    handleError(error)
    const config = JSON.parse(JSON.stringify(defaultConfig))

    // Apply PORT environment variable even on error fallback
    if (process.env.PORT) {
      config.listen.port = parseInt(process.env.PORT, 10)
      debug('Using PORT from environment: %s', config.listen.port)
    }

    return config
  }
}

// For backward compatibility, we need to maintain a singleton config object
// This will be initialized when the module is first imported
let configInstance = null
let configLoadPromise = null

/**
 * Gets the initialized configuration instance
 * @returns {Promise<Object>} Configuration object
 */
export function getConfig() {
  if (configInstance) {
    return Promise.resolve(configInstance)
  }

  if (!configLoadPromise) {
    configLoadPromise = loadConfigAsync().then((config) => {
      configInstance = config
      // Add getCorsConfig to the config object
      configInstance.getCorsConfig = getCorsConfig
      return configInstance
    })
  }

  return configLoadPromise
}

/**
 * Loads and validates the WebSSH2 configuration.
 * Merges the default configuration with user-provided config.json if it exists.
 * Falls back to default configuration if config.json is missing or invalid.
 * Overrides listen.port with PORT environment variable if provided.
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
/**
 * Loads configuration synchronously for backward compatibility
 * @returns {Object} Configuration object
 */
function loadConfigSync() {
  try {
    // Use native fs module with native JSON parsing (read-config-ng v4.0.2 is broken)
    // eslint-disable-next-line no-undef
    const fs = require('fs')
    const configPath = getConfigPath()

    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8')
      const providedConfig = JSON.parse(data)
      const mergedConfig = deepMerge(JSON.parse(JSON.stringify(defaultConfig)), providedConfig)

      if (process.env.PORT) {
        mergedConfig.listen.port = parseInt(process.env.PORT, 10)
        debug('Using PORT from environment: %s', mergedConfig.listen.port)
      }

      const validatedConfig = validateConfig(mergedConfig)
      debug('Merged and validated configuration')
      return validatedConfig
    }
    debug('Missing config.json for webssh. Using default config')
    const config = JSON.parse(JSON.stringify(defaultConfig))

    // Apply PORT environment variable to default config
    if (process.env.PORT) {
      config.listen.port = parseInt(process.env.PORT, 10)
      debug('Using PORT from environment: %s', config.listen.port)
    }

    return config
  } catch (err) {
    // Handle JSON parse errors or other issues gracefully
    const error = new ConfigError(`Problem loading config.json for webssh: ${err.message}`)
    handleError(error)
    const config = JSON.parse(JSON.stringify(defaultConfig))

    // Apply PORT environment variable even on error fallback
    if (process.env.PORT) {
      config.listen.port = parseInt(process.env.PORT, 10)
      debug('Using PORT from environment: %s', config.listen.port)
    }

    return config
  }
}

// For now, we'll use a hybrid approach during migration
// The config is loaded lazily when first accessed for backward compatibility
// But we also expose async methods for the new implementation
const config = new Proxy(
  {},
  {
    get(target, prop) {
      if (!configInstance) {
        configInstance = loadConfigSync()
        // Add getCorsConfig to the config object
        configInstance.getCorsConfig = getCorsConfig
      }
      return configInstance[prop]
    },
  }
)

function getCorsConfig() {
  const currentConfig = configInstance || config
  return {
    origin: currentConfig.http.origins,
    methods: ['GET', 'POST'],
    credentials: true,
  }
}

/**
 * Resets the configuration instance for testing purposes
 * @internal
 */
export function resetConfigForTesting() {
  configInstance = null
  configLoadPromise = null
  debug('Config instance reset for testing')
}

// Add getCorsConfig to the config object
config.getCorsConfig = getCorsConfig

// Export both the synchronous config (for backward compatibility)
// and the async getConfig function for the new implementation
export default config
export { loadConfigAsync, getConfigPath }
