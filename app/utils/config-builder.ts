// app/utils/config-builder.ts
// Configuration builder utility for creating and validating configs

import type { Config, ConfigValidationResult, ConfigValidationError } from '../types/config.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'
import { validateConfigPure } from './config-validator.js'
import { DEFAULT_SSO_HEADERS } from '../constants/security.js'
import { 
  validateSshHost,
  validateSshPort,
  validateCssColor
} from '../validation/config.js'

/**
 * Transform config to enhanced config with full validation
 */
export function enhanceConfig(config: Config): Result<Config, ConfigValidationError[]> {
  // Use the existing validation pipeline
  const validationResult = validateConfigPure(config)
  
  if (!validationResult.ok) {
    // Convert validation error to our error format
    return err([{
      path: '',
      message: validationResult.error.message,
      value: config
    }])
  }
  
  // Additional branded type validations
  const errors: ConfigValidationError[] = []
  
  if (config.ssh.host != null) {
    try {
      validateSshHost(config.ssh.host)
    } catch (e) {
      errors.push({
        path: 'ssh.host',
        message: (e as Error).message,
        value: config.ssh.host,
      })
    }
  }
  
  try {
    validateSshPort(config.ssh.port)
  } catch (e) {
    errors.push({
      path: 'ssh.port',
      message: (e as Error).message,
      value: config.ssh.port,
    })
  }
  
  if (config.header.background !== '') {
    try {
      validateCssColor(config.header.background)
    } catch (e) {
      errors.push({
        path: 'header.background',
        message: (e as Error).message,
        value: config.header.background,
      })
    }
  }
  
  if (errors.length > 0) {
    return err(errors)
  }
  
  return ok(config)
}

/**
 * Configuration builder for creating validated configs
 */
export class ConfigBuilder {
  private readonly config: Partial<Config> = {}
  
  withSshHost(host: string | null): this {
    this.config.ssh = {
      ...this.config.ssh,
      host,
    } as Config['ssh']
    return this
  }
  
  withSshPort(port: number): this {
    this.config.ssh = {
      ...this.config.ssh,
      port,
    } as Config['ssh']
    return this
  }
  
  withSshLocalAddress(localAddress: string): this {
    this.config.ssh = {
      ...this.config.ssh,
      localAddress,
    } as Config['ssh']
    return this
  }
  
  withSshLocalPort(localPort: number): this {
    this.config.ssh = {
      ...this.config.ssh,
      localPort,
    } as Config['ssh']
    return this
  }
  
  withSshAlgorithms(algorithms: Partial<Config['ssh']['algorithms']>): this {
    const currentAlgorithms = this.config.ssh?.algorithms
    this.config.ssh = {
      ...this.config.ssh,
      algorithms: {
        cipher: algorithms.cipher ?? currentAlgorithms?.cipher ?? [],
        compress: algorithms.compress ?? currentAlgorithms?.compress ?? [],
        hmac: algorithms.hmac ?? currentAlgorithms?.hmac ?? [],
        kex: algorithms.kex ?? currentAlgorithms?.kex ?? [],
        serverHostKey: algorithms.serverHostKey ?? currentAlgorithms?.serverHostKey ?? [],
      },
    } as Config['ssh']
    return this
  }
  
  withSshAllowedSubnets(subnets: string[]): this {
    this.config.ssh = {
      ...this.config.ssh,
      allowedSubnets: subnets,
    } as Config['ssh']
    return this
  }
  
  withHeader(text: string | null, background: string): this {
    this.config.header = { text, background }
    return this
  }
  
  withOptions(options: Partial<Config['options']>): this {
    const defaultOptions = {
      challengeButton: false,
      autoLog: false,
      allowReauth: false,
      allowReconnect: false,
      allowReplay: false,
      replayCRLF: false,
    }
    this.config.options = {
      ...defaultOptions,
      ...this.config.options,
      ...options,
    } as Config['options']
    return this
  }
  
  withSessionSecret(secret: string): this {
    this.config.session = {
      name: this.config.session?.name ?? 'webssh2',
      ...this.config.session,
      secret,
    } as Config['session']
    return this
  }
  
  withSessionName(name: string): this {
    this.config.session = {
      secret: this.config.session?.secret ?? '',
      ...this.config.session,
      name,
    } as Config['session']
    return this
  }
  
  withSsoConfig(sso: Partial<Config['sso']>): this {
    this.config.sso = {
      ...this.config.sso,
      ...sso,
    } as Config['sso']
    return this
  }
  
  withHttpOrigins(origins: string[]): this {
    this.config.http = { origins }
    return this
  }
  
  withListenConfig(ip: string, port: number): this {
    this.config.listen = { ip, port }
    return this
  }
  
  withUserCredentials(user: Partial<Config['user']>): this {
    this.config.user = {
      ...this.config.user,
      ...user,
    } as Config['user']
    return this
  }
  
  validate(): ConfigValidationResult {
    // Set defaults for required fields
    const fullConfig: Config = {
      listen: this.config.listen ?? { ip: '0.0.0.0', port: 2222 },
      http: this.config.http ?? { origins: [] },
      user: this.config.user ?? {
        name: null,
        password: null,
        privateKey: null,
        passphrase: null,
      },
      ssh: {
        host: null,
        port: 22,
        term: 'xterm-256color',
        readyTimeout: 20000,
        keepaliveInterval: 60000,
        keepaliveCountMax: 10,
        allowedSubnets: [],
        alwaysSendKeyboardInteractivePrompts: false,
        disableInteractiveAuth: false,
        algorithms: {
          cipher: [],
          compress: [],
          hmac: [],
          kex: [],
          serverHostKey: [],
        },
        ...this.config.ssh,
      },
      header: this.config.header ?? {
        text: null,
        background: 'green',
      },
      options: this.config.options ?? {
        challengeButton: false,
        autoLog: false,
        allowReauth: false,
        allowReconnect: false,
        allowReplay: false,
        replayCRLF: false,
      },
      session: this.config.session ?? {
        secret: '',
        name: 'webssh2',
      },
      sso: this.config.sso ?? {
        enabled: false,
        csrfProtection: false,
        trustedProxies: [],
        headerMapping: DEFAULT_SSO_HEADERS,
      },
    }
    
    return enhanceConfig(fullConfig)
  }
  
  build(): Config | null {
    const result = this.validate()
    if (result.ok) {
      return result.value
    }
    return null
  }
}