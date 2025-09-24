// app/config/transformers.ts
// Pure transformation functions for configuration

import type { Config } from '../types/config.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'
import { deepMergePure } from '../utils/object-merger.js'
import { validateConfigPure } from '../utils/config-validator.js'
import { createCompleteDefaultConfig } from './default-config.js'

export interface MaskedConfig {
  listen: Config['listen']
  http: {
    origins: string
  }
  user: {
    name: string | null
    password: string | null
    privateKey: string | null
    passphrase: string | null
  }
  ssh: {
    host: Config['ssh']['host']
    port: Config['ssh']['port']
    localAddress?: Config['ssh']['localAddress']
    localPort?: Config['ssh']['localPort']
    term: Config['ssh']['term']
    readyTimeout: Config['ssh']['readyTimeout']
    keepaliveInterval: Config['ssh']['keepaliveInterval']
    keepaliveCountMax: Config['ssh']['keepaliveCountMax']
    allowedSubnets: number
    algorithms: {
      cipher: number
      kex: number
      hmac: number
      compress: number
      serverHostKey: number
    }
  }
  header: Config['header']
  options: Config['options']
  session: {
    name: string
    secret: string
  }
  sso: {
    enabled: boolean
    csrfProtection: boolean
    trustedProxies: number
  }
}

/**
 * Merges configurations in order of precedence
 * @param base - Base configuration
 * @param overlay - Configuration to overlay on base
 * @returns Merged configuration
 * @pure
 */
export const mergeConfigs = (base: Config, overlay: Partial<Config>): Config => {
  return deepMergePure(base, overlay)
}

/**
 * Applies default values to a partial configuration
 * @param config - Partial configuration
 * @returns Complete configuration with defaults
 * @pure
 */
export const applyDefaults = (config: Partial<Config>): Config => {
  const defaults: Config = createCompleteDefaultConfig()

  return deepMergePure(defaults, config)
}

/**
 * Validates configuration object
 * @param config - Configuration to validate
 * @returns Validation result
 * @pure
 */
export const validateConfig = (config: unknown): Result<Config> => {
  // Basic structure validation
  if (config == null || typeof config !== 'object') {
    return err(new Error('Configuration must be an object'))
  }

  // Use existing validation
  const validationResult = validateConfigPure(config as Config)
  if (validationResult.ok) {
    return ok(validationResult.value as Config)
  } else {
    return err(new Error(validationResult.error.message))
  }
}

/**
 * Masks sensitive configuration data for logging
 * @param config - Configuration to mask
 * @returns Masked configuration safe for logging
 * @pure
 */
export const maskSensitiveConfig = (config: Config): MaskedConfig => {
  return {
    listen: config.listen,
    http: {
      origins: config.http.origins.length > 0 
        ? `${config.http.origins.length} origin(s)` 
        : 'none'
    },
    user: {
      name: config.user.name != null && config.user.name !== '' ? '***' : null,
      password: config.user.password != null && config.user.password !== '' ? '***' : null,
      privateKey: config.user.privateKey != null && config.user.privateKey !== '' ? '***' : null,
      passphrase: config.user.passphrase != null && config.user.passphrase !== '' ? '***' : null
    },
    ssh: {
      host: config.ssh.host,
      port: config.ssh.port,
      localAddress: config.ssh.localAddress,
      localPort: config.ssh.localPort,
      term: config.ssh.term,
      readyTimeout: config.ssh.readyTimeout,
      keepaliveInterval: config.ssh.keepaliveInterval,
      keepaliveCountMax: config.ssh.keepaliveCountMax,
      allowedSubnets: config.ssh.allowedSubnets?.length ?? 0,
      algorithms: {
        cipher: config.ssh.algorithms.cipher.length,
        kex: config.ssh.algorithms.kex.length,
        hmac: config.ssh.algorithms.hmac.length,
        compress: config.ssh.algorithms.compress.length,
        serverHostKey: config.ssh.algorithms.serverHostKey.length
      }
    },
    header: config.header,
    options: config.options,
    session: {
      name: config.session.name,
      secret: config.session.secret === '' ? 'not set' : '***'
    },
    sso: {
      enabled: config.sso.enabled,
      csrfProtection: config.sso.csrfProtection,
      trustedProxies: config.sso.trustedProxies.length
    }
  }
}

/**
 * Normalizes port value to valid range
 * @param port - Port value to normalize
 * @param defaultPort - Default port if invalid
 * @returns Normalized port number
 * @pure
 */
export const normalizePort = (port: unknown, defaultPort: number = 22): number => {
  if (port == null) {
    return defaultPort
  }
  
  let portNum: number
  if (typeof port === 'number') {
    portNum = port
  } else if (typeof port === 'string') {
    portNum = Number.parseInt(port, 10)
  } else {
    portNum = Number.NaN
  }
  
  if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return defaultPort
  }
  
  return portNum
}

/**
 * Sanitizes algorithm list by removing duplicates and empty values
 * @param algorithms - List of algorithms
 * @returns Sanitized algorithm list
 * @pure
 */
export const sanitizeAlgorithmList = (algorithms: string[]): string[] => {
  return [...new Set(algorithms.filter(algo => algo !== '' && algo.trim() !== ''))]
}

/**
 * Validates and normalizes SSH algorithms configuration
 * @param algorithms - SSH algorithms configuration
 * @returns Normalized algorithms configuration
 * @pure
 */
export const normalizeAlgorithms = (
  algorithms: Partial<Config['ssh']['algorithms']>
): Config['ssh']['algorithms'] => {
  const defaults: Config['ssh']['algorithms'] = {
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
  }

  return {
    cipher: sanitizeAlgorithmList(algorithms.cipher ?? defaults.cipher),
    compress: sanitizeAlgorithmList(algorithms.compress ?? defaults.compress),
    hmac: sanitizeAlgorithmList(algorithms.hmac ?? defaults.hmac),
    kex: sanitizeAlgorithmList(algorithms.kex ?? defaults.kex),
    serverHostKey: sanitizeAlgorithmList(algorithms.serverHostKey ?? defaults.serverHostKey),
  }
}

/**
 * Validates CORS origins configuration
 * @param origins - List of allowed origins
 * @returns Validation result with normalized origins
 * @pure
 */
export const validateCorsOrigins = (origins: unknown): Result<string[]> => {
  if (!Array.isArray(origins)) {
    return err(new Error('CORS origins must be an array'))
  }

  const normalized = origins
    .filter((origin): origin is string => typeof origin === 'string')
    .filter(origin => origin.trim() !== '')
    .map(origin => origin.trim())

  if (normalized.length === 0) {
    return ok(['*:*']) // Default to allow all
  }

  return ok(normalized)
}

/**
 * Creates a safe configuration subset for client-side usage
 * @param config - Full configuration
 * @returns Configuration safe for client exposure
 * @pure
 */
export const createClientSafeConfig = (config: Config): Partial<Config> => {
  return {
    listen: config.listen,
    ssh: {
      host: config.ssh.host,
      port: config.ssh.port,
      term: config.ssh.term,
      readyTimeout: config.ssh.readyTimeout,
      keepaliveInterval: config.ssh.keepaliveInterval,
      keepaliveCountMax: config.ssh.keepaliveCountMax,
      allowedSubnets: config.ssh.allowedSubnets ?? [],
      alwaysSendKeyboardInteractivePrompts: config.ssh.alwaysSendKeyboardInteractivePrompts,
      disableInteractiveAuth: config.ssh.disableInteractiveAuth,
      algorithms: config.ssh.algorithms,
    },
    header: config.header,
    options: config.options,
  }
}

/**
 * Validates session configuration
 * @param session - Session configuration
 * @returns Validation result
 * @pure
 */
export const validateSessionConfig = (
  session: Partial<Config['session']>
): Result<Config['session']> => {
  if (session.name == null || session.name.trim() === '') {
    return err(new Error('Session name is required'))
  }

  if (session.secret == null || session.secret.trim() === '') {
    return err(new Error('Session secret is required'))
  }

  if (session.secret.length < 32) {
    return err(new Error('Session secret must be at least 32 characters'))
  }

  return ok({
    name: session.name.trim(),
    secret: session.secret
  })
}

/**
 * Merges multiple partial configurations with priority
 * @param configs - Array of partial configs in order of increasing priority
 * @returns Merged configuration
 * @pure
 */
export const mergeMultipleConfigs = (...configs: Array<Partial<Config>>): Partial<Config> => {
  return configs.reduce<Partial<Config>>((merged, config) => {
    return deepMergePure(merged, config)
  }, {})
}