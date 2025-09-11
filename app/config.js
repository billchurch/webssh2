// server
// app/config.js
// @ts-check

import path, { dirname } from 'path'
import { promises as fs } from 'fs'
import { deepMerge, validateConfig } from './utils.js'
import { generateSecureSecret } from './crypto-utils.js'
import { createNamespacedDebug } from './logger.js'
import { ConfigError, handleError } from './errors.js'
import { DEFAULTS } from './constants.js'
import { loadEnvironmentConfig } from './envConfig.js'

const debug = createNamespacedDebug('config')

/**
 * @typedef {import('./types/config').Config} Config
 */

/** @type {Config} */
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
      // Prefer modern, faster, and safer algorithms first to speed negotiation
      cipher: [
        'chacha20-poly1305@openssh.com',
        'aes128-gcm',
        'aes128-gcm@openssh.com',
        'aes256-gcm',
        'aes256-gcm@openssh.com',
        'aes128-ctr',
        'aes192-ctr',
        'aes256-ctr',
        'aes256-cbc',
      ],
      compress: ['none', 'zlib@openssh.com', 'zlib'],
      hmac: [
        'hmac-sha2-256-etm@openssh.com',
        'hmac-sha2-512-etm@openssh.com',
        'hmac-sha1-etm@openssh.com',
        'hmac-sha2-256',
        'hmac-sha2-512',
        'hmac-sha1',
      ],
      kex: [
        'curve25519-sha256',
        'curve25519-sha256@libssh.org',
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521',
        'diffie-hellman-group14-sha256',
        'diffie-hellman-group-exchange-sha256',
        'diffie-hellman-group14-sha1',
      ],
      serverHostKey: [
        'ssh-ed25519',
        'rsa-sha2-512',
        'rsa-sha2-256',
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
  sso: {
    enabled: false,
    csrfProtection: false,
    trustedProxies: [],
    headerMapping: {
      username: 'x-apm-username',
      password: 'x-apm-password',
      session: 'x-apm-session',
    },
  },
}

import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function getConfigPath() {
  return path.join(__dirname, '..', 'config.json')
}

/**
 * Asynchronously loads configuration with priority: ENV vars > config.json > defaults
 * @returns {Promise<Object>} Configuration object
 */
/**
 * Asynchronously loads configuration with priority: ENV vars > config.json > defaults
 * @returns {Promise<Config>}
 */
async function loadConfigAsync() {
  const configPath = getConfigPath()
  /** @type {Config} */
  let config = JSON.parse(JSON.stringify(defaultConfig)) // Start with defaults

  try {
    // Check if config file exists using async fs.access
    await fs.access(configPath)

    // Use native Node.js JSON parsing to load config.json
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- configPath is constructed from __dirname, not user input
    const data = await fs.readFile(configPath, 'utf8')
    /** @type {Partial<Config>} */
    const providedConfig = JSON.parse(data)

    // Merge config.json over defaults
    config = deepMerge(config, providedConfig)
    debug('Loaded and merged config.json')
  } catch (err) {
    if (err.code === 'ENOENT') {
      debug('Missing config.json for webssh. Using default config')
    } else {
      debug('Error loading config.json: %s', err.message)
      const error = new ConfigError(`Problem loading config.json for webssh: ${err.message}`)
      handleError(error)
      // Continue with defaults on config file error
    }
  }

  // Load environment variables and merge with highest priority
  const envConfig = loadEnvironmentConfig()
  if (Object.keys(envConfig).length > 0) {
    config = deepMerge(config, envConfig)
    debug('Merged environment variables into configuration')
    // Debug header configuration after env merge
    if (config.header) {
      debug('Header config after env merge: %O', config.header)
    }
  }

  try {
    const validatedConfig = validateConfig(config)
    debug('Configuration loaded and validated successfully')
    return validatedConfig
  } catch (validationErr) {
    debug('Configuration validation failed: %s', validationErr.message)
    // Return unvalidated config for development/debugging
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

function getCorsConfig() {
  const currentConfig = configInstance
  if (!currentConfig) {
    throw new ConfigError('Configuration not loaded. Call getConfig() first.')
  }
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
function resetConfigForTesting() {
  configInstance = null
  configLoadPromise = null
  debug('Config instance reset for testing')
}

// Export only the async functions for the new implementation
export { loadConfigAsync, getConfigPath, getCorsConfig, resetConfigForTesting }
