// app/auth/providers/manual-auth.provider.ts
// Manual authentication provider implementation

import type { Credentials } from '../../validation/credentials.js'
import { createNamespacedDebug } from '../../logger.js'
import type { AuthProvider, AuthMethod } from './auth-provider.interface.js'

const debug = createNamespacedDebug('auth:manual')

/**
 * Manual Auth Provider - handles interactive authentication
 * User provides credentials through the UI
 */
export class ManualAuthProvider implements AuthProvider {
  private credentials: Credentials | null = null
  
  setCredentials(creds: Credentials): void {
    this.credentials = creds
    debug('Credentials set for manual authentication')
  }

  getCredentials(): Credentials | null {
    return this.credentials
  }

  getAuthMethod(): AuthMethod {
    return 'manual'
  }

  isAuthenticated(): boolean {
    // Manual auth doesn't pre-authenticate, it happens interactively
    return false
  }
}