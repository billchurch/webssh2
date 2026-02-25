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
  it('returns allowed auth methods, hostKeyVerification, and disables caching', () => {
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
      hostKeyVerification: {
        enabled: false,
        clientStoreEnabled: true,
        unknownKeyAction: 'prompt',
      },
    })
  })

  it('includes hostKeyVerification reflecting default config', () => {
    const config = createDefaultConfig('test-session-secret')

    const result = createSshConfigResponse(createRequest(), config)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const data = result.value.data as Record<string, unknown>
    expect(data['hostKeyVerification']).toEqual({
      enabled: false,
      clientStoreEnabled: true,
      unknownKeyAction: 'prompt',
    })
  })

  it('reflects enabled=true when host key verification is enabled', () => {
    const config = createDefaultConfig('test-session-secret')
    config.ssh.hostKeyVerification.enabled = true

    const result = createSshConfigResponse(createRequest(), config)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const data = result.value.data as Record<string, unknown>
    const hkv = data['hostKeyVerification'] as Record<string, unknown>
    expect(hkv['enabled']).toBe(true)
  })

  it('reflects clientStoreEnabled=false when client store is disabled', () => {
    const config = createDefaultConfig('test-session-secret')
    config.ssh.hostKeyVerification.clientStore.enabled = false

    const result = createSshConfigResponse(createRequest(), config)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const data = result.value.data as Record<string, unknown>
    const hkv = data['hostKeyVerification'] as Record<string, unknown>
    expect(hkv['clientStoreEnabled']).toBe(false)
  })

  it('reflects unknownKeyAction=reject when configured', () => {
    const config = createDefaultConfig('test-session-secret')
    config.ssh.hostKeyVerification.unknownKeyAction = 'reject'

    const result = createSshConfigResponse(createRequest(), config)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const data = result.value.data as Record<string, unknown>
    const hkv = data['hostKeyVerification'] as Record<string, unknown>
    expect(hkv['unknownKeyAction']).toBe('reject')
  })

  it('does not expose serverStore internals (dbPath, mode) to client', () => {
    const config = createDefaultConfig('test-session-secret')

    const result = createSshConfigResponse(createRequest(), config)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const data = result.value.data as Record<string, unknown>
    const hkv = data['hostKeyVerification'] as Record<string, unknown>
    expect(hkv).not.toHaveProperty('dbPath')
    expect(hkv).not.toHaveProperty('mode')
    expect(hkv).not.toHaveProperty('serverStore')
  })
})
