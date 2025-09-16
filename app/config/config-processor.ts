// app/config/config-processor.ts
// Pure functions for config processing

import type { Config } from '../types/config.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../types/result.js'
import { deepMergePure } from '../utils/object-merger.js'
import { validateConfigPure } from '../utils/config-validator.js'
import { DEFAULTS } from '../constants.js'

/**
 * Create default configuration
 * Pure function - no side effects
 * 
 * @param sessionSecret - Optional session secret
 * @returns Default configuration object
 */
export function createDefaultConfig(sessionSecret?: string): Config {
  return {
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
      secret: sessionSecret ?? '',
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
}

/**
 * Merge configurations in order of precedence
 * Pure function - returns new config without mutations
 * 
 * @param defaultConfig - Default configuration
 * @param fileConfig - Configuration from file (optional)
 * @param envConfig - Configuration from environment (optional)
 * @returns Merged configuration
 */
export function mergeConfigs(
  defaultConfig: Config,
  fileConfig?: Partial<Config>,
  envConfig?: Partial<Config>
): Config {
  let merged = defaultConfig
  
  if (fileConfig != null) {
    merged = deepMergePure(merged, fileConfig)
  }
  
  if (envConfig != null) {
    merged = deepMergePure(merged, envConfig)
  }
  
  return merged
}

/**
 * Process and validate configuration
 * Pure function - returns Result type
 * 
 * @param defaultConfig - Default configuration
 * @param fileConfig - Configuration from file (optional)
 * @param envConfig - Configuration from environment (optional)
 * @returns Result with validated config or error
 */
export function processConfig(
  defaultConfig: Config,
  fileConfig?: Partial<Config>,
  envConfig?: Partial<Config>
): Result<Config, { message: string; originalConfig: Config }> {
  const merged = mergeConfigs(defaultConfig, fileConfig, envConfig)
  const validationResult = validateConfigPure(merged)
  
  if (validationResult.ok) {
    return ok(validationResult.value as Config)
  }
  
  return err({
    message: validationResult.error.message,
    originalConfig: merged
  })
}

/**
 * Parse JSON configuration safely
 * Pure function - returns Result type
 * 
 * @param jsonString - JSON string to parse
 * @returns Result with parsed config or error
 */
export function parseConfigJson(jsonString: string): Result<Partial<Config>, Error> {
  try {
    const parsed = JSON.parse(jsonString) as Partial<Config>
    return ok(parsed)
  } catch (error) {
    if (error instanceof Error) {
      return err(error)
    }
    return err(new Error(String(error)))
  }
}

/**
 * Create CORS configuration from config
 * Pure function - no side effects
 * 
 * @param config - Application configuration
 * @returns CORS configuration object
 */
export function createCorsConfig(config: Config): {
  origin: string[]
  methods: string[]
  credentials: boolean
} {
  return {
    origin: config.http.origins,
    methods: ['GET', 'POST'],
    credentials: true
  }
}