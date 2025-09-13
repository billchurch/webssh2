// server
// app/auth/auth-pipeline.ts

import type { IncomingMessage } from 'node:http'
import { createNamespacedDebug } from '../logger.js'
import { isValidCredentials, maskSensitiveData } from '../utils.js'
import type { Credentials } from '../utils.js'
import type { Config } from '../types/config.js'
import type { AuthSession } from './auth-utils.js'

const debug = createNamespacedDebug('auth-pipeline')

export type AuthMethod = 'manual' | 'basicAuth' | 'post'

export interface AuthProvider {
  getCredentials(): Credentials | null
  getAuthMethod(): AuthMethod
  isAuthenticated(): boolean
}

type ExtendedRequest = IncomingMessage & {
  session?: AuthSession
  res?: unknown
}

/**
 * Basic Auth Provider - extracts credentials from session (set by routes)
 */
export class BasicAuthProvider implements AuthProvider {
  constructor(private req: ExtendedRequest) {}

  getCredentials(): Credentials | null {
    const session = this.req.session
    if (!session?.usedBasicAuth || !session.sshCredentials) {
      return null
    }

    const creds = session.sshCredentials
    const result: Credentials = {
      host: creds.host ?? '',
      port: creds.port ?? 22,
      username: creds.username ?? '',
      password: creds.password ?? '',
    }
    if (creds.term) {
      result.term = creds.term
    }
    return result
  }

  getAuthMethod(): AuthMethod {
    return 'basicAuth'
  }

  isAuthenticated(): boolean {
    const session = this.req.session
    debug(
      `BasicAuthProvider.isAuthenticated() check: usedBasicAuth=${session?.usedBasicAuth}, hasCredentials=${!!session?.sshCredentials}`
    )
    const result = !!(session?.usedBasicAuth && session.sshCredentials)
    debug(`BasicAuthProvider.isAuthenticated() result: ${result}`)
    return result
  }
}

/**
 * POST Auth Provider - extracts credentials from session (set by routes)
 */
export class PostAuthProvider implements AuthProvider {
  constructor(private req: ExtendedRequest) {}

  getCredentials(): Credentials | null {
    const session = this.req.session
    if (session?.authMethod !== 'POST' || !session.sshCredentials) {
      return null
    }

    const creds = session.sshCredentials
    const result: Credentials = {
      host: creds.host ?? '',
      port: creds.port ?? 22,
      username: creds.username ?? '',
      password: creds.password ?? '',
    }
    if (creds.term) {
      result.term = creds.term
    }
    return result
  }

  getAuthMethod(): AuthMethod {
    return 'post'
  }

  isAuthenticated(): boolean {
    return !!(this.req.session?.authMethod === 'POST' && this.req.session.sshCredentials)
  }
}

/**
 * Manual Auth Provider - waits for credentials via WebSocket
 */
export class ManualAuthProvider implements AuthProvider {
  private credentials: Credentials | null = null

  setCredentials(creds: Credentials): void {
    this.credentials = creds
  }

  getCredentials(): Credentials | null {
    return this.credentials
  }

  getAuthMethod(): AuthMethod {
    return 'manual'
  }

  isAuthenticated(): boolean {
    return this.credentials !== null && isValidCredentials(this.credentials)
  }
}

/**
 * Unified Authentication Pipeline
 * Handles all three authentication methods through a common interface
 */
export class UnifiedAuthPipeline {
  private provider: AuthProvider | null = null

  constructor(
    private req: ExtendedRequest,
    _config: Config
  ) {
    this.detectAuthProvider()
  }

  /**
   * Detect which authentication provider to use based on request
   */
  private detectAuthProvider(): void {
    // Check for Basic Auth first (session-based)
    if (this.req.session?.usedBasicAuth && this.req.session.sshCredentials) {
      debug('Detected Basic Auth provider')
      this.provider = new BasicAuthProvider(this.req)
      return
    }

    // Check for POST Auth (session-based)
    if (this.req.session?.authMethod === 'POST' && this.req.session.sshCredentials) {
      debug('Detected POST Auth provider')
      this.provider = new PostAuthProvider(this.req)
      return
    }

    // Default to Manual Auth
    debug('Using Manual Auth provider')
    this.provider = new ManualAuthProvider()
  }

  /**
   * Get the current auth provider
   */
  getProvider(): AuthProvider | null {
    return this.provider
  }

  /**
   * Get authentication method
   */
  getAuthMethod(): AuthMethod | null {
    return this.provider?.getAuthMethod() ?? null
  }

  /**
   * Check if already authenticated
   */
  isAuthenticated(): boolean {
    return this.provider?.isAuthenticated() ?? false
  }

  /**
   * Get credentials from current provider
   */
  getCredentials(): Credentials | null {
    return this.provider?.getCredentials() ?? null
  }

  /**
   * Set credentials for manual auth and force switch to manual provider
   */
  setManualCredentials(creds: Record<string, unknown>): boolean {
    if (isValidCredentials(creds as Credentials)) {
      // Force switch to manual auth provider
      debug('Switching to manual auth provider for new credentials')
      const manualProvider = new ManualAuthProvider()
      manualProvider.setCredentials(creds as Credentials)
      this.provider = manualProvider
      debug('Manual credentials set: %O', maskSensitiveData(creds))
      return true
    }
    return false
  }

  /**
   * Get masked credentials for logging
   */
  getMaskedCredentials(): unknown {
    const creds = this.getCredentials()
    return creds ? maskSensitiveData(creds) : null
  }

  /**
   * Check if provider requires auth request (manual only)
   */
  requiresAuthRequest(): boolean {
    return this.provider instanceof ManualAuthProvider && !this.isAuthenticated()
  }
}
