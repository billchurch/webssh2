import { describe, expect, it } from 'vitest'
import { createSshConfigResponse } from '../../../app/routes/handlers/ssh-config-handler.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { AUTH_METHOD_TOKENS } from '../../../app/constants/index.js'
import { createAuthMethod } from '../../../app/types/branded.js'
import type { SshRouteRequest } from '../../../app/routes/handlers/ssh-handler.js'
import type { AuthSession } from '../../../app/auth/auth-utils.js'

const createRequest = (): SshRouteRequest => ({
  session: {} as AuthSession,
  query: {},
  params: {},
  headers: {},
})

describe('createSshConfigResponse', () => {
  it('returns allowed auth methods and disables caching', () => {
    const config = createDefaultConfig('test-session-secret')
    config.ssh.allowedAuthMethods = [
      createAuthMethod(AUTH_METHOD_TOKENS.PUBLIC_KEY),
      createAuthMethod(AUTH_METHOD_TOKENS.PASSWORD),
    ]

    const result = createSshConfigResponse(createRequest(), config)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.status).toBe(200)
    expect(result.value.headers).toEqual({ 'Cache-Control': 'no-store' })
    expect(result.value.data).toEqual({
      allowedAuthMethods: ['publickey', 'password'],
    })
  })
})
