// app/auth/providers/auth-factory.ts
// Factory for creating appropriate authentication providers

import type { IncomingMessage } from 'node:http'
import { createNamespacedDebug } from '../../logger.js'
import type { Config } from '../../types/config.js'
import type { AuthSession } from '../auth-utils.js'
import type { AuthProvider } from './auth-provider.interface.js'
import { BasicAuthProvider } from './basic-auth.provider.js'
import { PostAuthProvider } from './post-auth.provider.js'
import { ManualAuthProvider } from './manual-auth.provider.js'

const debug = createNamespacedDebug('auth:factory')

type ExtendedRequest = IncomingMessage & {
  session?: AuthSession
  res?: unknown
}

/**
 * Create an authentication provider based on the request context
 * @param req - Incoming request with session
 * @param config - Application configuration
 * @returns Appropriate authentication provider instance
 * @pure
 */
export function createAuthProvider(
  req: ExtendedRequest,
  _config: Config
): AuthProvider {
  const session = req.session
  
  // Check for Basic Auth
  if (session?.usedBasicAuth === true) {
    debug('Creating BasicAuthProvider')
    return new BasicAuthProvider(req)
  }
  
  // Check for POST Auth
  if (session?.authMethod === 'POST') {
    debug('Creating PostAuthProvider')
    return new PostAuthProvider(req)
  }
  
  // Default to Manual Auth
  debug('Creating ManualAuthProvider (default)')
  return new ManualAuthProvider()
}

/**
 * Determine authentication method from request
 * @param req - Incoming request with session
 * @returns Authentication method string
 * @pure
 */
export function getAuthMethod(req: ExtendedRequest): string {
  const session = req.session
  
  if (session?.usedBasicAuth === true) {
    return 'basicAuth'
  }
  
  if (session?.authMethod === 'POST') {
    return 'post'
  }
  
  return 'manual'
}