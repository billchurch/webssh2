// app/config/safe-logging.ts
// Safe masking of configuration data for logging

import type { Config } from '../types/config.js'

export interface MaskedThemingConfig {
  enabled: boolean
  allowCustom: boolean
  defaultTheme: string
  headerBackground: string
  themesCount: number
  additionalThemesCount: number
}

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
  options: Omit<Config['options'], 'theming'>
  session: {
    name: string
    secret: string
  }
  sso: {
    enabled: boolean
    csrfProtection: boolean
    trustedProxies: number
  }
  theming?: MaskedThemingConfig
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
  // config.options.theming is optional in OptionsConfig; use direct property access
  const themingCfg = config.options.theming
  const maskedTheming: MaskedThemingConfig | undefined =
    themingCfg === undefined
      ? undefined
      : {
          enabled: themingCfg.enabled,
          allowCustom: themingCfg.allowCustom,
          defaultTheme: themingCfg.defaultTheme,
          headerBackground: themingCfg.headerBackground,
          themesCount: themingCfg.themes?.length ?? 0,
          additionalThemesCount: themingCfg.additionalThemes.length
        }

  const optionsWithoutTheming: Omit<Config['options'], 'theming'> = {
    challengeButton: config.options.challengeButton,
    autoLog: config.options.autoLog,
    allowReauth: config.options.allowReauth,
    allowReconnect: config.options.allowReconnect,
    allowReplay: config.options.allowReplay,
    ...(config.options.replayCRLF !== undefined && { replayCRLF: config.options.replayCRLF })
  }

  // The following guards use eslint-disable because Config types declare these
  // fields as required, but tests pass partial objects via `as unknown as Config`.
  // The guards prevent runtime crashes in that scenario.
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  const httpOrigins: string[] =
    config.http === undefined ? [] : [...config.http.origins]
  const sshMasked: MaskedConfig['ssh'] =
    config.ssh === undefined
      ? ({} as MaskedConfig['ssh'])
      : {
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
        }
  const sessionMasked: MaskedConfig['session'] =
    config.session === undefined
      ? { name: '', secret: 'not set' }
      : { name: config.session.name, secret: maskSessionSecret(config.session.secret) }
  const ssoMasked: MaskedConfig['sso'] =
    config.sso === undefined
      ? { enabled: false, csrfProtection: false, trustedProxies: 0 }
      : {
          enabled: config.sso.enabled,
          csrfProtection: config.sso.csrfProtection,
          trustedProxies: config.sso.trustedProxies.length
        }
  const userMasked = {
    name: maskWhenFilled(config.user?.name),
    password: maskWhenFilled(config.user?.password),
    privateKey: maskWhenFilled(config.user?.privateKey),
    passphrase: maskWhenFilled(config.user?.passphrase)
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  return {
    listen: config.listen,
    http: { origins: httpOrigins },
    user: userMasked,
    ssh: sshMasked,
    header: config.header,
    options: optionsWithoutTheming,
    session: sessionMasked,
    sso: ssoMasked,
    ...(maskedTheming !== undefined && { theming: maskedTheming })
  }
}
