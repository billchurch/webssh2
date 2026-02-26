// server
// app/auth/auth-pipeline.ts

import type { IncomingMessage } from 'node:http'
import { createNamespacedDebug } from '../logger.js'
import { isValidCredentials, type Credentials } from '../validation/index.js'
import { maskSensitive } from '../utils/data-masker.js'
import type { Config } from '../types/config.js'
import type { AuthSession } from './auth-utils.js'
import {
  BasicAuthProvider,
  PostAuthProvider,
  type AuthProvider,
  type AuthMethod,
} from './providers/index.js'

export type { AuthProvider, AuthMethod } from './providers/index.js'

const debug = createNamespacedDebug('auth-pipeline')

type ExtendedRequest = IncomingMessage & {
  session?: AuthSession
  res?: unknown
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
    private readonly req: ExtendedRequest,
    _config: Config
  ) {
    this.detectAuthProvider()
  }

  /**
   * Detect which authentication provider to use based on request
   */
  private detectAuthProvider(): void {
    // Skip Basic Auth provider if auth recently failed
    // This ensures fresh credentials are prompted instead of reusing cached failed ones
    if (this.req.session?.authFailed === true) {
      debug('Skipping Basic Auth due to recent auth failure, using Manual Auth provider')
      this.provider = new ManualAuthProvider()
      return
    }

    // Check for Basic Auth first (session-based)
    if (this.req.session?.usedBasicAuth === true && this.req.session.sshCredentials != null) {
      debug('Detected Basic Auth provider')
      this.provider = new BasicAuthProvider(this.req)
      return
    }

    // Check for POST Auth (session-based)
    if (this.req.session?.authMethod === 'POST' && this.req.session.sshCredentials != null) {
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
      debug('Manual credentials set: %O', maskSensitive(creds))
      return true
    }
    return false
  }

  /**
   * Get masked credentials for logging
   */
  getMaskedCredentials(): unknown {
    const creds = this.getCredentials()
    return creds == null ? null : maskSensitive(creds)
  }

  /**
   * Check if provider requires auth request (manual only)
   */
  requiresAuthRequest(): boolean {
    return this.provider instanceof ManualAuthProvider && !this.isAuthenticated()
  }
}
