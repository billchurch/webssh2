import { describe, expect, it } from 'vitest'
import {
  processClearCredentialsRequest,
  processReauthRequest
} from '../../../app/routes/handlers/ssh-handler.js'
import { HTTP } from '../../../app/constants/index.js'
import type { AuthSession } from '../../../app/auth/auth-utils.js'
import { TEST_PASSWORD, TEST_USERNAME } from '../../test-constants.js'

const credentialSession = (): AuthSession => ({
  sshCredentials: {
    host: 'example.com',
    port: 22,
    username: TEST_USERNAME,
    password: TEST_PASSWORD
  },
  usedBasicAuth: true,
  authMethod: 'POST',
  envVars: { FOO: 'bar' },
  sshHost: 'example.com',
  sshPort: 22,
  authFailed: false,
  csrfToken: 'token'
})

describe('processClearCredentialsRequest', () => {
  it('selects the credential keys and returns the unchanged 200 response', () => {
    const result = processClearCredentialsRequest(credentialSession())

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.keysToRemove).toEqual(expect.arrayContaining([
      'sshCredentials',
      'usedBasicAuth',
      'authMethod',
      'envVars',
      'sshHost',
      'sshPort',
      'authFailed'
    ]))
    expect(result.value.keysToRemove).not.toContain('csrfToken')
    expect(result.value.response).toEqual({
      status: HTTP.OK,
      data: { message: HTTP.CREDENTIALS_CLEARED }
    })
  })

  it('includes every key the reauth flow removes, without duplicates', () => {
    const session = credentialSession()
    const result = processClearCredentialsRequest(session)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const { keysToRemove } = processReauthRequest(session)
    expect(result.value.keysToRemove).toEqual(expect.arrayContaining(keysToRemove))
    expect(new Set(result.value.keysToRemove).size).toBe(result.value.keysToRemove.length)
  })

  it('succeeds for a session without credentials', () => {
    const result = processClearCredentialsRequest({})

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.keysToRemove).toEqual(expect.arrayContaining(['sshCredentials', 'envVars']))
    expect(result.value.response.status).toBe(HTTP.OK)
  })

  it('does not change the session it reads', () => {
    const session = credentialSession()
    const before = structuredClone(session)

    processClearCredentialsRequest(session)

    expect(session).toEqual(before)
  })
})
