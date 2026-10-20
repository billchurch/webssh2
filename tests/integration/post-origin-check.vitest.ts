// tests/integration/post-origin-check.vitest.ts
// CSRF origin check on the credential POST routes of the SSH and telnet
// routers (#580). Accepted requests reach the route handler, which serves the
// client page (200); rejected requests get 403 { error: 'Forbidden' }.

import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import session from 'express-session'
import request from 'supertest'
import { createRoutesV2 } from '../../app/routes/routes-v2.js'
import { createTelnetRoutes } from '../../app/routes/telnet-routes.js'
import { createCSRFMiddleware } from '../../app/middleware/csrf.middleware.js'
import { createBodyParserMiddleware } from '../../app/middleware/body-parser.middleware.js'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import { HTTP, TELNET_DEFAULTS } from '../../app/constants/index.js'
import type { Config } from '../../app/types/config.js'
import type { StructuredLogger } from '../../app/logging/structured-logger.js'
import {
  TEST_SESSION_SECRET_VALID,
  TEST_USERNAME,
  TEST_PASSWORD
} from '../test-constants.js'

const PORTAL = 'https://portal.example.com'
const EVIL = 'https://evil.example'
const TARGET_HOST = 'ssh.example.internal'
const SSO_USER_HEADER = 'x-apm-username'
const CREDENTIALS = { username: TEST_USERNAME, password: TEST_PASSWORD, host: TARGET_HOST }

interface ConfigOptions {
  allowedPostOrigins?: string[]
  sso?: { enabled: boolean; csrfProtection: boolean; trustedProxies?: string[] }
}

function buildConfig(options: ConfigOptions = {}): Config {
  const config = createDefaultConfig(TEST_SESSION_SECRET_VALID)
  config.csp.mode = 'off'
  if (options.allowedPostOrigins !== undefined) {
    config.http.allowedPostOrigins = options.allowedPostOrigins
  }
  if (options.sso !== undefined) {
    config.sso.enabled = options.sso.enabled
    config.sso.csrfProtection = options.sso.csrfProtection
    config.sso.trustedProxies = options.sso.trustedProxies ?? []
  }
  config.telnet = {
    enabled: true,
    defaultPort: TELNET_DEFAULTS.PORT,
    timeout: TELNET_DEFAULTS.TIMEOUT_MS,
    term: TELNET_DEFAULTS.TERM,
    auth: {
      loginPrompt: TELNET_DEFAULTS.LOGIN_PROMPT,
      passwordPrompt: TELNET_DEFAULTS.PASSWORD_PROMPT,
      failurePattern: TELNET_DEFAULTS.FAILURE_PATTERN,
      expectTimeout: TELNET_DEFAULTS.EXPECT_TIMEOUT_MS
    },
    allowedSubnets: []
  }
  return config
}

function buildApp(config: Config): express.Application {
  const app = express()
  app.use(session({ secret: config.session.secret, resave: false, saveUninitialized: false }))
  app.use(createBodyParserMiddleware())
  app.use('/ssh', createRoutesV2(config))
  app.use('/telnet', createTelnetRoutes(config))
  return app
}

type Headers = Record<string, string>

const SSH_ROUTES = ['/ssh', `/ssh/host/${TARGET_HOST}`] as const
const TELNET_ROUTES = ['/telnet', `/telnet/host/${TARGET_HOST}`] as const
const ALL_ROUTES = [...SSH_ROUTES, ...TELNET_ROUTES] as const

function post(app: express.Application, path: string, headers: Headers = {}): request.Test {
  return request(app).post(path).type('form').set(headers).send(CREDENTIALS)
}

function expectRejected(res: request.Response): void {
  expect(res.status).toBe(HTTP.FORBIDDEN)
  expect(res.body).toEqual({ error: HTTP.FORBIDDEN_MESSAGE })
}

function expectAccepted(res: request.Response): void {
  expect(res.status).toBe(HTTP.OK)
}

describe('credential POST routes without the origin check (default)', () => {
  const app = buildApp(buildConfig())

  it.each(ALL_ROUTES)('POST %s accepts cross-site requests exactly as before', async (path) => {
    expectAccepted(await post(app, path, { Origin: EVIL, 'Sec-Fetch-Site': 'cross-site' }))
    expectAccepted(await post(app, path, { Origin: 'null' }))
    expectAccepted(await post(app, path))
  })

  it('mounts no extra middleware on the POST routes', () => {
    type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: unknown[] } }
    const routers = [createRoutesV2(buildConfig()), createTelnetRoutes(buildConfig())]
    for (const router of routers) {
      const postRoutes = (router as unknown as { stack: Layer[] }).stack
        .filter((layer) => layer.route?.methods['post'] === true && layer.route.path !== '/csp-report')
      expect(postRoutes).toHaveLength(2)
      for (const layer of postRoutes) {
        expect(layer.route?.stack).toHaveLength(1)
      }
    }
  })
})

// One row per entry of the decision table in SECURITY.md
const DECISION_TABLE: ReadonlyArray<{ row: string; headers: Headers; accept: boolean }> = [
  { row: '1 same-origin', headers: { 'Sec-Fetch-Site': 'same-origin', Origin: 'https://gateway.example' }, accept: true },
  { row: '2a Origin null', headers: { Origin: 'null', 'Sec-Fetch-Site': 'cross-site' }, accept: false },
  { row: '2b listed Origin', headers: { Origin: PORTAL, 'Sec-Fetch-Site': 'cross-site' }, accept: true },
  { row: '2b listed Origin, case and default port', headers: { Origin: 'HTTPS://Portal.Example.com:443' }, accept: true },
  { row: '2c unlisted Origin', headers: { Origin: EVIL, 'Sec-Fetch-Site': 'cross-site' }, accept: false },
  { row: '3 no Origin, no Sec-Fetch-Site', headers: {}, accept: true },
  { row: '4 same-site without Origin', headers: { 'Sec-Fetch-Site': 'same-site' }, accept: false },
  { row: '4 cross-site without Origin', headers: { 'Sec-Fetch-Site': 'cross-site' }, accept: false },
  { row: '4 none without Origin', headers: { 'Sec-Fetch-Site': 'none' }, accept: false }
]

describe('credential POST routes with http.allowedPostOrigins', () => {
  const app = buildApp(buildConfig({ allowedPostOrigins: [`${PORTAL}/`] }))

  describe.each(SSH_ROUTES)('SSH router POST %s', (path) => {
    it.each(DECISION_TABLE)('row $row', async ({ headers, accept }) => {
      const res = await post(app, path, headers)
      if (accept) {
        expectAccepted(res)
      } else {
        expectRejected(res)
      }
    })
  })

  describe.each(TELNET_ROUTES)('telnet router POST %s', (path) => {
    it.each(DECISION_TABLE)('row $row', async ({ headers, accept }) => {
      const res = await post(app, path, headers)
      if (accept) {
        expectAccepted(res)
      } else {
        expectRejected(res)
      }
    })
  })

  it('leaves GET routes and the CSP report endpoint alone', async () => {
    const config = buildConfig({ allowedPostOrigins: [PORTAL] })
    config.csp.mode = 'report-only'
    const cspApp = buildApp(config)
    const report = await request(cspApp)
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/csp-report')
      .set('Origin', EVIL)
      .send(JSON.stringify({ 'csp-report': { 'violated-directive': 'script-src' } }))
    expect(report.status).toBe(204)

    const get = await request(cspApp).get('/ssh').set('Origin', EVIL)
    expect(get.status).toBe(HTTP.OK)
  })
})

describe('credential POST routes with SSO csrfProtection and no allowlist', () => {
  const PROXY_IP = '::ffff:127.0.0.1'
  const ssoConfig = buildConfig({ sso: { enabled: true, csrfProtection: true, trustedProxies: [PROXY_IP] } })
  const app = buildApp(ssoConfig)
  const crossSite = { Origin: EVIL, 'Sec-Fetch-Site': 'cross-site' }

  it.each(ALL_ROUTES)('POST %s accepts same-origin', async (path) => {
    expectAccepted(await post(app, path, { 'Sec-Fetch-Site': 'same-origin' }))
  })

  it.each(ALL_ROUTES)('POST %s rejects cross-site from an untrusted IP', async (path) => {
    const untrusted = buildApp(buildConfig({ sso: { enabled: true, csrfProtection: true } }))
    expectRejected(await post(untrusted, path, crossSite))
  })

  it.each(ALL_ROUTES)('POST %s accepts the trusted proxy IP', async (path) => {
    expectAccepted(await post(app, path, crossSite))
  })

  it.each(ALL_ROUTES)('POST %s accepts requests carrying the SSO username header', async (path) => {
    const untrusted = buildApp(buildConfig({ sso: { enabled: true, csrfProtection: true } }))
    expectAccepted(await post(untrusted, path, { ...crossSite, [SSO_USER_HEADER]: TEST_USERNAME }))
  })

  it('accepts a listed Origin once an allowlist is added', async () => {
    const withList = buildApp(buildConfig({
      allowedPostOrigins: [PORTAL],
      sso: { enabled: true, csrfProtection: true }
    }))
    expectAccepted(await post(withList, '/ssh', { Origin: PORTAL, 'Sec-Fetch-Site': 'cross-site' }))
  })
})

describe('origin check rejection logging', () => {
  it('logs route, Origin, Sec-Fetch-Site and step, never the posted credentials', async () => {
    const warn = vi.fn((_entry: unknown) => ({ ok: true as const, value: undefined }))
    const logger = { warn } as unknown as StructuredLogger
    const config = buildConfig({ allowedPostOrigins: [PORTAL] })
    const app = express()
    app.use(createBodyParserMiddleware())
    app.post('/ssh/host/:host', createCSRFMiddleware(config, { logger }), (_req, res) => {
      res.status(HTTP.OK).end()
    })

    const res = await post(app, `/ssh/host/${TARGET_HOST}`, { Origin: EVIL, 'Sec-Fetch-Site': 'cross-site' })
    expectRejected(res)

    expect(warn).toHaveBeenCalledTimes(1)
    const entry = warn.mock.calls[0]?.[0] as { event: string; context: Record<string, unknown>; data: Record<string, unknown> }
    expect(entry.event).toBe('policy_block')
    expect(entry.context).toMatchObject({ subsystem: 'security', reason: 'post_origin_unlisted-origin' })
    expect(entry.data).toEqual({
      route: `/ssh/host/${TARGET_HOST}`,
      origin: EVIL,
      secFetchSite: 'cross-site',
      step: 'unlisted-origin'
    })
    expect(JSON.stringify(entry)).not.toContain(TEST_PASSWORD)
  })

  it('does not log accepted requests', async () => {
    const warn = vi.fn((_entry: unknown) => ({ ok: true as const, value: undefined }))
    const logger = { warn } as unknown as StructuredLogger
    const app = express()
    app.post('/ssh', createCSRFMiddleware(buildConfig({ allowedPostOrigins: [PORTAL] }), { logger }), (_req, res) => {
      res.status(HTTP.OK).end()
    })
    expectAccepted(await request(app).post('/ssh').set('Origin', PORTAL))
    expect(warn).not.toHaveBeenCalled()
  })
})
