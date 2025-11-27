// app/config/default-config.ts
// Shared default configuration object

import crypto from 'node:crypto'
import type {
  Config,
  LoggingConfig,
  LoggingControlsConfig,
  LoggingSamplingConfig,
  LoggingRateLimitConfig,
  LoggingStdoutConfig,
  LoggingSyslogConfig,
  LoggingSyslogTlsConfig
} from '../types/config.js'
import { DEFAULT_AUTH_METHODS, DEFAULTS, STREAM_LIMITS } from '../constants/index.js'
import { createAuthMethod } from '../types/branded.js'

/**
 * Default SSH algorithms configuration
 */
export const DEFAULT_SSH_ALGORITHMS: Config['ssh']['algorithms'] = {
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

/**
 * Base default configuration (without session secret)
 */
export const DEFAULT_CONFIG_BASE: Omit<Config, 'session'> & { session: Omit<Config['session'], 'secret'> } = {
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
    allowedSubnets: [],
    alwaysSendKeyboardInteractivePrompts: false,
    disableInteractiveAuth: false,
    algorithms: DEFAULT_SSH_ALGORITHMS,
    allowedAuthMethods: DEFAULT_AUTH_METHODS.map(createAuthMethod),
    maxExecOutputBytes: STREAM_LIMITS.MAX_EXEC_OUTPUT_BYTES,
    outputRateLimitBytesPerSec: STREAM_LIMITS.OUTPUT_RATE_LIMIT_BYTES_PER_SEC,
    socketHighWaterMark: STREAM_LIMITS.SOCKET_HIGH_WATER_MARK,
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
  logging: {
    namespace: 'webssh2:app',
    minimumLevel: 'info',
    stdout: {
      enabled: true
    }
  },
}

/**
 * Create a complete default configuration with session secret
 * Deep clones nested objects to prevent mutation
 * If no sessionSecret is provided, generates a secure one
 */
export function createCompleteDefaultConfig(sessionSecret?: string): Config {
  // Generate a secure secret if none provided
  const secret = sessionSecret ?? crypto.randomBytes(32).toString('hex')
  const loggingConfig = cloneLoggingConfig(DEFAULT_CONFIG_BASE.logging)
  return {
    listen: { ...DEFAULT_CONFIG_BASE.listen },
    http: { origins: [...DEFAULT_CONFIG_BASE.http.origins] },
    user: { ...DEFAULT_CONFIG_BASE.user },
    ssh: {
      ...DEFAULT_CONFIG_BASE.ssh,
      algorithms: {
        cipher: [...DEFAULT_CONFIG_BASE.ssh.algorithms.cipher],
        compress: [...DEFAULT_CONFIG_BASE.ssh.algorithms.compress],
        hmac: [...DEFAULT_CONFIG_BASE.ssh.algorithms.hmac],
        kex: [...DEFAULT_CONFIG_BASE.ssh.algorithms.kex],
        serverHostKey: [...DEFAULT_CONFIG_BASE.ssh.algorithms.serverHostKey],
      },
      allowedSubnets: DEFAULT_CONFIG_BASE.ssh.allowedSubnets == null ? [] : [...DEFAULT_CONFIG_BASE.ssh.allowedSubnets],
      allowedAuthMethods: [...DEFAULT_CONFIG_BASE.ssh.allowedAuthMethods],
    },
    header: { ...DEFAULT_CONFIG_BASE.header },
    options: { ...DEFAULT_CONFIG_BASE.options },
    session: {
      ...DEFAULT_CONFIG_BASE.session,
      secret,
    },
    sso: {
      ...DEFAULT_CONFIG_BASE.sso,
      trustedProxies: [...DEFAULT_CONFIG_BASE.sso.trustedProxies],
      headerMapping: { ...DEFAULT_CONFIG_BASE.sso.headerMapping },
    },
    ...(loggingConfig === undefined ? {} : { logging: loggingConfig })
  }
}

function cloneLoggingConfig(config: LoggingConfig | undefined): LoggingConfig | undefined {
  if (config === undefined) {
    return undefined
  }

  const clonedControls = cloneLoggingControls(config.controls)
  const clonedStdout = cloneLoggingStdout(config.stdout)
  const clonedSyslog = cloneLoggingSyslog(config.syslog)

  return {
    ...(config.namespace === undefined ? {} : { namespace: config.namespace }),
    ...(config.minimumLevel === undefined ? {} : { minimumLevel: config.minimumLevel }),
    ...(clonedControls === undefined ? {} : { controls: clonedControls }),
    ...(clonedStdout === undefined ? {} : { stdout: clonedStdout }),
    ...(clonedSyslog === undefined ? {} : { syslog: clonedSyslog })
  }
}

function cloneLoggingControls(
  controls: LoggingControlsConfig | undefined
): LoggingControlsConfig | undefined {
  if (controls === undefined) {
    return undefined
  }

  const sampling = cloneLoggingSampling(controls.sampling)
  const rateLimit = cloneLoggingRateLimit(controls.rateLimit)

  if (sampling === undefined && rateLimit === undefined) {
    return {}
  }

  return {
    ...(sampling === undefined ? {} : { sampling }),
    ...(rateLimit === undefined ? {} : { rateLimit })
  }
}

function cloneLoggingSampling(
  sampling: LoggingSamplingConfig | undefined
): LoggingSamplingConfig | undefined {
  if (sampling === undefined) {
    return undefined
  }

  return {
    ...(sampling.defaultSampleRate === undefined ? {} : { defaultSampleRate: sampling.defaultSampleRate }),
    ...(sampling.rules === undefined
      ? {}
      : {
          rules: sampling.rules.map((rule) => ({ ...rule }))
        })
  }
}

function cloneLoggingRateLimit(
  rateLimit: LoggingRateLimitConfig | undefined
): LoggingRateLimitConfig | undefined {
  if (rateLimit === undefined) {
    return undefined
  }

  return {
    ...(rateLimit.rules === undefined
      ? {}
      : {
          rules: rateLimit.rules.map((rule) => ({ ...rule }))
        })
  }
}

function cloneLoggingStdout(
  stdout: LoggingStdoutConfig | undefined
): LoggingStdoutConfig | undefined {
  if (stdout === undefined) {
    return undefined
  }

  return {
    enabled: stdout.enabled,
    ...(stdout.minimumLevel === undefined ? {} : { minimumLevel: stdout.minimumLevel })
  }
}

function cloneLoggingSyslog(
  syslog: LoggingSyslogConfig | undefined
): LoggingSyslogConfig | undefined {
  if (syslog === undefined) {
    return undefined
  }

  const clonedTls = cloneLoggingSyslogTls(syslog.tls)

  const base: LoggingSyslogConfig = {
    enabled: syslog.enabled,
    ...(syslog.host === undefined ? {} : { host: syslog.host }),
    ...(syslog.port === undefined ? {} : { port: syslog.port }),
    ...(syslog.appName === undefined ? {} : { appName: syslog.appName }),
    ...(syslog.enterpriseId === undefined ? {} : { enterpriseId: syslog.enterpriseId }),
    ...(syslog.bufferSize === undefined ? {} : { bufferSize: syslog.bufferSize }),
    ...(syslog.flushIntervalMs === undefined ? {} : { flushIntervalMs: syslog.flushIntervalMs }),
    ...(syslog.includeJson === undefined ? {} : { includeJson: syslog.includeJson })
  }

  return clonedTls === undefined ? base : { ...base, tls: clonedTls }
}

function cloneLoggingSyslogTls(
  tls: LoggingSyslogTlsConfig | undefined
): LoggingSyslogTlsConfig | undefined {
  if (tls === undefined) {
    return undefined
  }

  return {
    enabled: tls.enabled,
    ...(tls.caFile === undefined ? {} : { caFile: tls.caFile }),
    ...(tls.certFile === undefined ? {} : { certFile: tls.certFile }),
    ...(tls.keyFile === undefined ? {} : { keyFile: tls.keyFile }),
    ...(tls.rejectUnauthorized === undefined ? {} : { rejectUnauthorized: tls.rejectUnauthorized })
  }
}
