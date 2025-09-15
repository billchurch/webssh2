// server
// app/config.ts

import path, { dirname } from 'path'
import { promises as fs, existsSync } from 'fs'
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
    readyTimeout: DEFAULTS.SSH_READY_TIMEOUT_MS,
    keepaliveInterval: DEFAULTS.SSH_KEEPALIVE_INTERVAL_MS,
    keepaliveCountMax: DEFAULTS.SSH_KEEPALIVE_COUNT_MAX,
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
    replayCRLF: false,
  },
  session: {
    secret: process.env['WEBSSH_SESSION_SECRET'] ?? generateSecureSecret(),
    name: DEFAULTS.SESSION_COOKIE_NAME,
  },
  sso: {
    enabled: false,
    csrfProtection: false,
    trustedProxies: [],
    headerMapping: {
      username: DEFAULTS.SSO_HEADERS.USERNAME,
      password: DEFAULTS.SSO_HEADERS.PASSWORD,
      session: DEFAULTS.SSO_HEADERS.SESSION,
    },
  },
}

const FILENAME = fileURLToPath(import.meta.url)
const DIRNAME = dirname(FILENAME)

function getConfigPath(): string {
  // Prefer project root config.json regardless of running from src or dist
  const candidateA = path.join(DIRNAME, '..', 'config.json')
  if (existsSync(candidateA)) {
    return candidateA
  }
  const candidateB = path.join(DIRNAME, '..', '..', 'config.json')
  if (existsSync(candidateB)) {
    return candidateB
  }
  return candidateA
}

export async function loadConfigAsync(): Promise<Config> {
  const configPath = getConfigPath()
  let config: Config = JSON.parse(JSON.stringify(defaultConfig)) as Config
  try {
    await fs.access(configPath)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- configPath is internal, not user input
    const data = await fs.readFile(configPath, 'utf8')
    const providedConfig = JSON.parse(data) as Partial<Config>
    config = deepMerge<Config>(config, providedConfig)
    debug('Loaded and merged config.json')
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'ENOENT') {
      debug('No config.json found, using environment variables and defaults')
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
    config = deepMerge<Config>(config, envConfig as Partial<Config>)
    debug('Merged environment variables into configuration')
    debug('Header config after env merge: %O', config.header)
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
  if (configInstance != null) {
    return Promise.resolve(configInstance)
  }
  configLoadPromise ??= loadConfigAsync().then((cfg) => {
    configInstance = cfg
    ;(
      configInstance as Config & {
        getCorsConfig?: () => { origin: string[]; methods: string[]; credentials: boolean }
      }
    ).getCorsConfig = getCorsConfig
    return configInstance
  })
  return configLoadPromise
}

export function getCorsConfig(): { origin: string[]; methods: string[]; credentials: boolean } {
  const currentConfig = configInstance
  if (currentConfig == null) {
    throw new ConfigError('Configuration not loaded. Call getConfig() first.')
  }
  return { origin: currentConfig.http.origins, methods: ['GET', 'POST'], credentials: true }
}

export function resetConfigForTesting(): void {
  configInstance = null
  configLoadPromise = null
  debug('Config instance reset for testing')
}
