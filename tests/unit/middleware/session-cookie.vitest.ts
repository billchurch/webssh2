// tests/unit/middleware/session-cookie.vitest.ts
// Session cookie attributes set by the production session middleware (#580)

import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createSessionMiddleware } from '../../../app/middleware/session.middleware.js'
import { createBodyParserMiddleware } from '../../../app/middleware/body-parser.middleware.js'
import { createRoutesV2 } from '../../../app/routes/routes-v2.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { TEST_SESSION_SECRET_VALID, TEST_USERNAME, TEST_PASSWORD } from '../../test-constants.js'

function buildApp(allowedPostOrigins?: string[]): express.Application {
  const config = createDefaultConfig(TEST_SESSION_SECRET_VALID)
  config.csp.mode = 'off'
  if (allowedPostOrigins !== undefined) {
    config.http.allowedPostOrigins = allowedPostOrigins
  }
  const app = express()
  app.use(createSessionMiddleware(config))
  app.use(createBodyParserMiddleware())
  app.use('/ssh', createRoutesV2(config))
  return app
}

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown
  const cookies = Array.isArray(raw) ? (raw as string[]) : []
  const cookie = cookies.find((value) => value.startsWith('webssh2.sid='))
  expect(cookie).toBeDefined()
  return cookie ?? ''
}

describe('session cookie attributes', () => {
  it('sets an explicit SameSite=Lax and HttpOnly on GET /ssh', async () => {
    const res = await request(buildApp()).get('/ssh')
    expect(res.status).toBe(200)
    const cookie = sessionCookie(res)
    expect(cookie).toMatch(/;\s*SameSite=Lax/i)
    expect(cookie).toMatch(/;\s*HttpOnly/i)
  })

  it('sets SameSite=Lax on the response to a listed portal credential POST', async () => {
    const res = await request(buildApp(['https://portal.example.com']))
      .post('/ssh/host/ssh.example.internal')
      .type('form')
      .set({ Origin: 'https://portal.example.com', 'Sec-Fetch-Site': 'cross-site' })
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
    expect(res.status).toBe(200)
    expect(sessionCookie(res)).toMatch(/;\s*SameSite=Lax/i)
  })
})
