// tests/integration/session-lifecycle.vitest.ts
// Sessions are only stored (and their cookie only issued) when a route writes
// to the session; stored sessions carry a bounded lifetime.

import { describe, it, expect } from 'vitest'
import express, { type Application } from 'express'
import request from 'supertest'
import { createAppAsync } from '../../app/app.js'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import { createSessionMiddleware } from '../../app/middleware/session.middleware.js'
import { EphemeralSessionStore } from '../../app/middleware/ephemeral-session-store.js'
import { DEFAULTS } from '../../app/constants/index.js'
import { TEST_SESSION_SECRET_VALID } from '@tests/test-constants.js'
import type { Config } from '../../app/types/config.js'

const SESSION_COOKIE = DEFAULTS.SESSION_COOKIE_NAME

const buildConfig = (mutate?: (config: Config) => void): Config => {
  const secret: string = TEST_SESSION_SECRET_VALID
  const config = createDefaultConfig(secret)
  mutate?.(config)
  return config
}

const setCookies = (res: request.Response): string[] => {
  const header = res.headers['set-cookie'] as string[] | string | undefined
  if (header === undefined) {
    return []
  }
  return Array.isArray(header) ? header : [header]
}

const sessionCookie = (res: request.Response): string | undefined =>
  setCookies(res).find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))

const storeLength = (store: EphemeralSessionStore): Promise<number> =>
  new Promise((resolve) => {
    store.length((_error, length) => {
      resolve(length ?? 0)
    })
  })

describe('session middleware', () => {
  it('does not store a session for repeated cookie-less requests', async () => {
    const store = new EphemeralSessionStore({ cleanupIntervalMs: 0 })
    const app = appWithStore(buildConfig(), store)

    for (let i = 0; i < 25; i++) {
      const res = await request(app).get('/read').expect(200)
      expect(sessionCookie(res)).toBeUndefined()
    }

    expect(await storeLength(store)).toBe(0)
  })

  it('stores a written session once and issues a bounded, httpOnly, lax cookie', async () => {
    const store = new EphemeralSessionStore({ cleanupIntervalMs: 0 })
    const config = buildConfig((c) => {
      c.session.sessionTimeout = 60_000
    })
    const app = appWithStore(config, store)

    const res = await request(app).get('/write').expect(200)
    const cookie = sessionCookie(res)
    expect(cookie).toBeDefined()
    expect(cookie).toMatch(/;\s*HttpOnly/i)
    expect(cookie).toMatch(/;\s*SameSite=Lax/i)
    expect(cookie).toMatch(/;\s*Expires=/i)
    expect(await storeLength(store)).toBe(1)

    // Reusing the cookie reuses the stored session rather than adding another.
    const sid = (cookie ?? '').split(';')[0]
    await request(app).get('/write').set('Cookie', sid).expect(200)
    expect(await storeLength(store)).toBe(1)
  })

  it('defaults the cookie lifetime to the session timeout default', async () => {
    const store = new EphemeralSessionStore({ cleanupIntervalMs: 0 })
    const app = appWithStore(buildConfig(), store)

    const before = Date.now()
    const res = await request(app).get('/write').expect(200)
    const expires = /Expires=([^;]+)/i.exec(sessionCookie(res) ?? '')?.[1]
    expect(expires).toBeDefined()
    const lifetime = Date.parse(expires ?? '') - before
    // Cookie dates have second precision.
    expect(Math.abs(lifetime - DEFAULTS.SESSION_TIMEOUT_MS)).toBeLessThan(2000)
  })
})

const sshApp = (): Application => createAppAsync(buildConfig()).app
const telnetApp = (): Application =>
  createAppAsync(
    buildConfig((c) => {
      if (c.telnet !== undefined) {
        c.telnet.enabled = true
      }
    })
  ).app

const appWithStore = (config: Config, store: EphemeralSessionStore): Application => {
  const app = express()
  app.use(createSessionMiddleware(config, store))
  app.get('/read', (req, res) => {
    res.json({ hasCredentials: req.session.sshCredentials != null })
  })
  app.get('/write', (req, res) => {
    req.session.usedBasicAuth = true
    res.json({ ok: true })
  })
  return app
}

describe('application routes and session persistence', () => {
  it.each(['/ssh/', '/ssh/config', '/ssh/does-not-exist'])(
    'issues no session cookie for an anonymous GET %s',
    async (path) => {
      const res = await request(sshApp()).get(path)
      expect(sessionCookie(res)).toBeUndefined()
    }
  )

  it('persists Basic auth credentials for /ssh/host/:host', async () => {
    const app = sshApp()
    const res = await request(app)
      .get('/ssh/host/localhost')
      .auth('user', 'pass')
      .expect(200)
    const cookie = sessionCookie(res)
    expect(cookie).toBeDefined()

    // The stored session carries the credentials: the connection cookie is
    // set from them on a later request that sends only the session cookie.
    const followUp = await request(app)
      .get('/ssh/')
      .set('Cookie', (cookie ?? '').split(';')[0])
      .expect(200)
    expect(setCookies(followUp).some((c) => c.startsWith('basicauth='))).toBe(true)
  })

  it('persists POST (SSO) credentials for /ssh/host/:host', async () => {
    const res = await request(sshApp())
      .post('/ssh/host/localhost')
      .type('form')
      .send({ username: 'user', password: 'pass' })
      .expect(200)
    expect(sessionCookie(res)).toBeDefined()
  })

  it('persists query options for /ssh/', async () => {
    const res = await request(sshApp()).get('/ssh/?header=hello').expect(200)
    expect(sessionCookie(res)).toBeDefined()
  })

  it('issues no session cookie for an anonymous telnet GET', async () => {
    const res = await request(telnetApp()).get('/telnet/').expect(200)
    expect(sessionCookie(res)).toBeUndefined()
  })

  it('persists query options for telnet routes', async () => {
    const res = await request(telnetApp()).get('/telnet/host/localhost?header=hello').expect(200)
    expect(sessionCookie(res)).toBeDefined()
  })
})
