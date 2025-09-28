// app/auth/providers/post-auth.provider.ts
// POST-based authentication provider implementation

import type { IncomingMessage } from 'node:http'
import { createNamespacedDebug } from '../../logger.js'
import type { Credentials } from '../../validation/credentials.js'
import { buildCredentials } from '../../utils/index.js'
import type { AuthSession } from '../auth-utils.js'
import type { AuthProvider, AuthMethod } from './auth-provider.interface.js'

const debug = createNamespacedDebug('auth:post')

type ExtendedRequest = IncomingMessage & {
  session?: AuthSession
  res?: unknown
}

/**
 * POST Auth Provider - extracts credentials from session (set by routes)
 * Handles form-based POST authentication flow
 */
export class PostAuthProvider implements AuthProvider {
  constructor(private readonly req: ExtendedRequest) {}

  getCredentials(): Credentials | null {
    const session = this.req.session
    if (session?.authMethod !== 'POST' || session.sshCredentials == null) {
      return null
    }

    return buildCredentials(session.sshCredentials)
  }

  getAuthMethod(): AuthMethod {
    return 'post'
  }

  isAuthenticated(): boolean {
    const result = Boolean(
      this.req.session?.authMethod === 'POST' && 
      this.req.session.sshCredentials != null
    )
    debug(`isAuthenticated() result: ${result}`)
    return result
  }
}