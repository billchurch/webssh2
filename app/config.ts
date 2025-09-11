// server
// app/config.ts

import path, { dirname } from 'path'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import { deepMerge, validateConfig } from './utils.js'
import { generateSecureSecret } from './crypto-utils.js'
import { createNamespacedDebug } from './logger.js'
import { ConfigError, handleError } from './errors.js'
import { DEFAULTS } from './constants.js'
import { loadEnvironmentConfig } from './envConfig.js'
import type { Config } from './types/config.js'

const debug = createNamespacedDebug('config')

const defaultConfig: Config = {
  listen: { ip: '0.0.0.0', port: DEFAULTS.LISTEN_PORT },
  http: { origins: ['*:*'] },
  user: { name: null, password: null, privateKey: null, passphrase: null },
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
  header: { text: null, background: 'green' },
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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function getConfigPath(): string {
  return path.join(__dirname, '..', 'config.json')
}

export async function loadConfigAsync(): Promise<Config> {
  const configPath = getConfigPath()
  let config: Config = JSON.parse(JSON.stringify(defaultConfig))
  try {
    await fs.access(configPath)
    const data = await fs.readFile(configPath, 'utf8')
    const providedConfig = JSON.parse(data) as Partial<Config>
    config = deepMerge(config, providedConfig)
    debug('Loaded and merged config.json')
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'ENOENT') {
      debug('Missing config.json for webssh. Using default config')
    } else {
      debug('Error loading config.json: %s', e.message)
      const error = new ConfigError(
        `Problem loading config.json for webssh: ${e.message ?? 'unknown error'}`
      )
      handleError(error)
    }
  }

  const envConfig = loadEnvironmentConfig()
  if (Object.keys(envConfig).length > 0) {
    config = deepMerge(config, envConfig as Partial<Config>)
    debug('Merged environment variables into configuration')
    if (config.header) {
      debug('Header config after env merge: %O', config.header)
    }
  }

  try {
    const validatedConfig = validateConfig(config) as Config
    debug('Configuration loaded and validated successfully')
    return validatedConfig
  } catch (validationErr: unknown) {
    const e = validationErr as { message?: string }
    debug('Configuration validation failed: %s', e.message)
    return config
  }
}

let configInstance: Config | null = null
let configLoadPromise: Promise<Config> | null = null

export function getConfig(): Promise<Config> {
  if (configInstance) {
    return Promise.resolve(configInstance)
  }
  if (!configLoadPromise) {
    configLoadPromise = loadConfigAsync().then((cfg) => {
      configInstance = cfg
      ;(
        configInstance as Config & {
          getCorsConfig?: () => { origin: string[]; methods: string[]; credentials: boolean }
        }
      ).getCorsConfig = getCorsConfig
      return configInstance
    })
  }
  return configLoadPromise
}

export function getCorsConfig() {
  const currentConfig = configInstance
  if (!currentConfig) {
    throw new ConfigError('Configuration not loaded. Call getConfig() first.')
  }
  return { origin: currentConfig.http.origins, methods: ['GET', 'POST'], credentials: true }
}

export function resetConfigForTesting() {
  configInstance = null
  configLoadPromise = null
  debug('Config instance reset for testing')
}
