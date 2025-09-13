// app/auth/providers/auth-provider.interface.ts
// Common interface for authentication providers

import type { Credentials } from '../../validation/credentials.js'

export type AuthMethod = 'manual' | 'basicAuth' | 'post'

/**
 * Interface for authentication providers
 * Each provider implements a specific authentication strategy
 */
export interface AuthProvider {
  /**
   * Get credentials from the authentication source
   * @returns Credentials object or null if not available
   */
  getCredentials(): Credentials | null
  
  /**
   * Get the authentication method used by this provider
   * @returns Authentication method identifier
   */
  getAuthMethod(): AuthMethod
  
  /**
   * Check if the user is authenticated with this provider
   * @returns true if authenticated
   */
  isAuthenticated(): boolean
}