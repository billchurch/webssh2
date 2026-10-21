// tests/integration/clear-credentials-route.vitest.ts
// GET /ssh/clear-credentials removes stored credentials from the session (#581).

import { describe, it, expect } from 'vitest'
import express, { type Application, type Request } from 'express'
import request from 'supertest'
import { createRoutesV2 } from '../../app/routes/routes-v2.js'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import { createSessionMiddleware } from '../../app/middleware/session.middleware.js'
import { BasicAuthProvider } from '../../app/auth/providers/basic-auth.provider.js'
import { HEADERS, HTTP } from '../../app/constants/index.js'
import type { AuthSession } from '../../app/auth/auth-utils.js'
import {
  TEST_PASSWORD,
  TEST_SESSION_SECRET_VALID,
  TEST_USERNAME
} from '../test-constants.js'

type SessionRequest = Request & { session: AuthSession }

interface PeekBody {
  keys: string[]
  authenticated: boolean
}

const peek = async (agent: ReturnType<typeof request.agent>): Promise<PeekBody> => {
  const res = await agent.get('/test/peek').expect(200)
  return res.body as PeekBody
}

const CREDENTIAL_KEYS = ['sshCredentials', 'usedBasicAuth', 'authMethod', 'envVars']

function buildApp(): Application {
  const secret: string = TEST_SESSION_SECRET_VALID
  const config = createDefaultConfig(secret)
  const app = express()
  app.use(createSessionMiddleware(config))

  app.get('/test/seed', (req, res) => {
    const { session } = req as SessionRequest
    session.sshCredentials = {
      host: 'example.com',
      port: 22,
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }
    session.usedBasicAuth = true
    session.authMethod = 'POST'
    session.envVars = { FOO: 'bar' }
    session['keep'] = 'me'
    res.sendStatus(204)
  })

  app.get('/test/peek', (req, res) => {
    const { session } = req as SessionRequest
    res.json({
      keys: Object.keys(session),
      authenticated: new BasicAuthProvider(req).isAuthenticated()
    })
  })

  app.use('/ssh', createRoutesV2(config))
  return app
}

const expectClearedResponse = (res: request.Response): void => {
  expect(res.status).toBe(HTTP.OK)
  expect(res.body).toEqual({ message: HTTP.CREDENTIALS_CLEARED })
  expect(res.headers[HEADERS.CLEAR_SITE_DATA.toLowerCase()]).toBe('"cookies"')
}

describe('GET /ssh/clear-credentials', () => {
  it('removes stored credentials so the session no longer authenticates', async () => {
    const agent = request.agent(buildApp())

    await agent.get('/test/seed').expect(204)
    const before = await peek(agent)
    expect(before.keys).toEqual(expect.arrayContaining(CREDENTIAL_KEYS))
    expect(before.authenticated).toBe(true)

    expectClearedResponse(await agent.get('/ssh/clear-credentials'))

    const after = await peek(agent)
    for (const key of CREDENTIAL_KEYS) {
      expect(after.keys).not.toContain(key)
    }
    expect(after.keys).toContain('keep')
    expect(after.authenticated).toBe(false)
  })

  it('succeeds without stored credentials and leaves the session as it was', async () => {
    const agent = request.agent(buildApp())

    expectClearedResponse(await agent.get('/ssh/clear-credentials'))
    expectClearedResponse(await agent.get('/ssh/clear-credentials'))

    const after = await peek(agent)
    expect(after.keys).toEqual(['cookie'])
    expect(after.authenticated).toBe(false)
  })
})
