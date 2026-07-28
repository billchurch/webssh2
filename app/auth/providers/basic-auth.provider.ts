// app/auth/providers/basic-auth.provider.ts
// Basic authentication provider implementation

import type { IncomingMessage } from 'node:http'
import { createNamespacedDebug } from '../../logger.js'
import type { Credentials } from '../../validation/credentials.js'
import { convertToAuthCredentials } from '../../utils/index.js'
import type { AuthSession } from '../auth-utils.js'
import type { AuthProvider, AuthMethod } from './auth-provider.interface.js'

const debug = createNamespacedDebug('auth:basic')

type ExtendedRequest = IncomingMessage & {
  session?: AuthSession
  res?: unknown
}

/**
 * Basic Auth Provider - extracts credentials from session (set by routes)
 * Handles HTTP Basic Authentication flow
 */
export class BasicAuthProvider implements AuthProvider {
  constructor(private readonly req: ExtendedRequest) {}

  getCredentials(): Credentials | null {
    const session = this.req.session
    if (session?.usedBasicAuth !== true || session.sshCredentials == null) {
      return null
    }

    return convertToAuthCredentials(session.sshCredentials)
  }

  getAuthMethod(): AuthMethod {
    return 'basicAuth'
  }

  isAuthenticated(): boolean {
    const session = this.req.session
    debug(
      `isAuthenticated() check: usedBasicAuth=${session?.usedBasicAuth}, hasCredentials=${Boolean(session?.sshCredentials)}`
    )
    const result = Boolean(session?.usedBasicAuth === true && session.sshCredentials != null)
    debug(`isAuthenticated() result: ${result}`)
    return result
  }
}