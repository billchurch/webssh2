// app/config/safe-logging.ts
// Safe masking of configuration data for logging

import type { Config } from '../types/config.js'

export interface MaskedConfig {
  listen: Config['listen']
  http: {
    origins: string[]
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
      cipher: string[]
      kex: string[]
      hmac: string[]
      compress: string[]
      serverHostKey: string[]
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

const maskWhenFilled = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null
  }
  if (value === '') {
    return null
  }
  return '***'
}

const maskSessionSecret = (secret: string): string => {
  if (secret.length === 0) {
    return 'not set'
  }
  return '***'
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
      origins: [...config.http.origins]
    },
    user: {
      name: maskWhenFilled(config.user.name),
      password: maskWhenFilled(config.user.password),
      privateKey: maskWhenFilled(config.user.privateKey),
      passphrase: maskWhenFilled(config.user.passphrase)
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
        cipher: [...config.ssh.algorithms.cipher],
        kex: [...config.ssh.algorithms.kex],
        hmac: [...config.ssh.algorithms.hmac],
        compress: [...config.ssh.algorithms.compress],
        serverHostKey: [...config.ssh.algorithms.serverHostKey]
      }
    },
    header: config.header,
    options: config.options,
    session: {
      name: config.session.name,
      secret: maskSessionSecret(config.session.secret)
    },
    sso: {
      enabled: config.sso.enabled,
      csrfProtection: config.sso.csrfProtection,
      trustedProxies: config.sso.trustedProxies.length
    }
  }
}
