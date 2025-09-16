// app/types/config-v2.ts
// Enhanced type-safe configuration with branded types
// Backwards compatible with existing Config interface

import type { Config as LegacyConfig } from './config.js'
import type { SshHost, SshPort, FilePath, CssColor } from './branded.js'
import type { SshAlgorithms } from './ssh.js'
import type { Result } from './result.js'

/**
 * Enhanced SSH configuration with branded types
 */
export interface EnhancedSshConfig {
  readonly host?: SshHost | null
  readonly port: SshPort
  readonly term: string
  readonly readyTimeout: number
  readonly keepaliveInterval: number
  readonly keepaliveCountMax: number
  readonly alwaysSendKeyboardInteractivePrompts: boolean
  readonly disableInteractiveAuth: boolean
  readonly algorithms: SshAlgorithms
  readonly envAllowlist?: ReadonlyArray<string>
}

/**
 * Enhanced header configuration
 */
export interface EnhancedHeaderConfig {
  readonly text?: string | null
  readonly background?: CssColor
  readonly style?: string
}

/**
 * Enhanced configuration with type safety
 */
export interface EnhancedConfig extends LegacyConfig {
  // Can add enhanced versions here
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  readonly path: string
  readonly message: string
  readonly value?: unknown
  readonly expected?: string
}

/**
 * Configuration validation result
 */
export type ConfigValidationResult = Result<EnhancedConfig, ConfigValidationError[]>

/**
 * Validate SSH host
 */
export function validateSshHost(host: string | null | undefined): SshHost | null {
  if (host == null || host === '') {
    return null
  }
  
  // Basic validation
  if (host.includes(' ')) {
    throw new Error(`Invalid SSH host: ${host} (contains spaces)`)
  }
  
  return host as SshHost
}

/**
 * Validate SSH port
 */
export function validateSshPort(port: number | undefined): SshPort {
  const p = port ?? 22
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    throw new Error(`Invalid SSH port: ${p}`)
  }
  return p as SshPort
}

/**
 * Validate CSS color
 */
export function validateCssColor(color: string | undefined): CssColor | undefined {
  if (color == null || color === '') {
    return undefined
  }
  // Basic validation - could be enhanced with actual CSS color validation
  return color as CssColor
}

/**
 * Validate file path
 */
export function validateFilePath(path: string | undefined): FilePath | undefined {
  if (path == null || path === '') {
    return undefined
  }
  return path as FilePath
}

/**
 * Transform legacy config to enhanced config
 */
export function enhanceConfig(config: LegacyConfig): Result<EnhancedConfig, ConfigValidationError[]> {
  const errors: ConfigValidationError[] = []
  
  try {
    // Validate SSH config
    if (config.ssh != null) {
      try {
        validateSshHost(config.ssh.host)
      } catch (e) {
        errors.push({
          path: 'ssh.host',
          message: (e as Error).message,
          value: config.ssh.host,
        })
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
    }
    
    // Validate header config
    if (config.header?.background != null) {
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
      return { ok: false, error: errors }
    }
    
    return { ok: true, value: config as EnhancedConfig }
  } catch (e) {
    return {
      ok: false,
      error: [{
        path: '',
        message: (e as Error).message,
      }]
    }
  }
}

/**
 * Configuration builder for creating validated configs
 */
export class ConfigBuilder {
  private config: Partial<LegacyConfig> = {}
  
  withSshHost(host: string | null): this {
    this.config.ssh = {
      ...this.config.ssh,
      host,
    } as LegacyConfig['ssh']
    return this
  }
  
  withSshPort(port: number): this {
    this.config.ssh = {
      ...this.config.ssh,
      port,
    } as LegacyConfig['ssh']
    return this
  }
  
  withHeader(text: string | null, background: string): this {
    this.config.header = { text, background }
    return this
  }
  
  withSessionSecret(secret: string): this {
    this.config.session = {
      ...this.config.session,
      secret,
    } as LegacyConfig['session']
    return this
  }
  
  validate(): ConfigValidationResult {
    // Set defaults for required fields
    const fullConfig: LegacyConfig = {
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
      },
      session: this.config.session ?? {
        secret: '',
        name: 'webssh2',
      },
      sso: this.config.sso ?? {
        enabled: false,
        csrfProtection: false,
        trustedProxies: [],
        headerMapping: {
          username: 'x-forwarded-user',
          password: 'x-forwarded-password',
          session: 'x-forwarded-session',
        },
      },
    }
    
    return enhanceConfig(fullConfig)
  }
  
  build(): EnhancedConfig | null {
    const result = this.validate()
    if (result.ok) {
      return result.value
    }
    return null
  }
}