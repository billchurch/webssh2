// app/config/default-config.ts
// Shared default configuration object

import type { Config } from '../types/config.js'
import { DEFAULTS } from '../constants.js'

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
}

/**
 * Create a complete default configuration with session secret
 * Deep clones nested objects to prevent mutation
 */
export function createCompleteDefaultConfig(sessionSecret = ''): Config {
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
    },
    header: { ...DEFAULT_CONFIG_BASE.header },
    options: { ...DEFAULT_CONFIG_BASE.options },
    session: {
      ...DEFAULT_CONFIG_BASE.session,
      secret: sessionSecret,
    },
    sso: {
      ...DEFAULT_CONFIG_BASE.sso,
      trustedProxies: [...DEFAULT_CONFIG_BASE.sso.trustedProxies],
      headerMapping: { ...DEFAULT_CONFIG_BASE.sso.headerMapping },
    },
  }
}