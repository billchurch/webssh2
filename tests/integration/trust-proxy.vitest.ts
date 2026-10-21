// tests/integration/trust-proxy.vitest.ts
// http.trustProxy end to end: HSTS, CSP connect-src variant, session cookie
// Secure flag, req.ip/req.protocol and the injected socket URL, with the
// setting unset (direct deployment) and set (behind a TLS-terminating proxy).

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import type { Application } from 'express'
import { createAppAsync } from '../../app/app.js'
import { createDefaultConfig, processConfig } from '../../app/config/config-processor.js'
import { TEST_SESSION_SECRET_VALID } from '@tests/test-constants.js'
import type { Config, TrustProxySetting } from '../../app/types/config.js'

const FORWARDED_HTTPS = {
  'X-Forwarded-Proto': 'https',
  'X-Forwarded-For': '203.0.113.7',
}

// A concrete CORS origin makes the plain-HTTP and TLS CSP variants differ
// (the default wildcard origin derives only 'self' for both).
const ORIGIN = 'gateway.example.com'
const STRICT_CONNECT_SRC = `connect-src 'self' https://${ORIGIN} wss://${ORIGIN}`
const PLAIN_CONNECT_SRC = `${STRICT_CONNECT_SRC} http://${ORIGIN} ws://${ORIGIN}`

// Session cookie attributes without and with http.trustProxy over HTTPS
const PLAIN_COOKIE_ATTRIBUTES = ['Path=/', 'HttpOnly', 'SameSite=Lax']
const SECURE_COOKIE_ATTRIBUTES = ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']

// Headers whose values differ per response; compared by presence only.
const VOLATILE_HEADERS = new Set(['date', 'etag', 'set-cookie'])

interface Probe {
  ip: string
  protocol: string
  secure: boolean
  peer: string | undefined
}

function buildApp(trustProxy?: TrustProxySetting, tweak?: (config: Config) => void): Application {
  const secret: string = TEST_SESSION_SECRET_VALID
  const config = createDefaultConfig(secret)
  config.http.origins = [ORIGIN]
  if (trustProxy !== undefined) {
    config.http.trustProxy = trustProxy
  }
  tweak?.(config)
  const { app } = createAppAsync(config)
  // Exposes what Express derived from the connection and forwarded headers.
  app.get('/probe', (req, res) => {
    const probe: Probe = {
      ip: req.ip ?? '',
      protocol: req.protocol,
      secure: req.secure,
      peer: req.socket.remoteAddress,
    }
    res.json(probe)
  })
  return app
}

function stableHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      VOLATILE_HEADERS.has(name) ? '<present>' : value,
    ])
  )
}

function cookieAttributes(headers: Record<string, unknown>): string[] {
  const cookies = headers['set-cookie'] as string[] | undefined
  expect(cookies).toHaveLength(1)
  const [, ...attributes] = (cookies as string[])[0].split('; ')
  return attributes
}

function connectSrcOf(headers: Record<string, unknown>): string {
  const csp = headers['content-security-policy-report-only'] as string
  return csp.split('; ').find((d) => d.startsWith('connect-src ')) ?? ''
}

function socketUrlOf(html: string): string | undefined {
  return /"socket":\{"url":"([^"]+)"/.exec(html)?.[1]
}

describe('http.trustProxy unset (default)', () => {
  it('serves GET /ssh/ with the direct-deployment headers and cookie attributes', async () => {
    const res = await request(buildApp()).get('/ssh/')
    expect(res.status).toBe(200)
    expect(stableHeaders(res.headers)).toEqual({
      'x-content-type-options': 'nosniff',
      'x-xss-protection': '1; mode=block',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'geolocation=(), microphone=(), camera=()',
      'x-frame-options': 'DENY',
      'content-security-policy-report-only':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        `img-src 'self' data:; font-src 'self'; ${PLAIN_CONNECT_SRC}; ` +
        "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; " +
        'report-uri /ssh/csp-report; report-to csp-endpoint',
      'reporting-endpoints': 'csp-endpoint="/ssh/csp-report"',
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
      'content-length': expect.any(String) as unknown,
      etag: '<present>',
      'set-cookie': '<present>',
      date: '<present>',
      connection: 'close',
    })
    expect(cookieAttributes(res.headers)).toEqual(PLAIN_COOKIE_ATTRIBUTES)
  })

  it('ignores X-Forwarded-* headers entirely', async () => {
    const app = buildApp()
    const plain = await request(app).get('/ssh/')
    const forwarded = await request(app).get('/ssh/').set(FORWARDED_HTTPS)
    expect(stableHeaders(forwarded.headers)).toEqual(stableHeaders(plain.headers))
    expect(cookieAttributes(forwarded.headers)).toEqual(PLAIN_COOKIE_ATTRIBUTES)
    expect(socketUrlOf(forwarded.text)).toMatch(/^http:\/\//)

    const probe = (await request(app).get('/probe').set(FORWARDED_HTTPS)).body as Probe
    expect(probe.secure).toBe(false)
    expect(probe.protocol).toBe('http')
    expect(probe.ip).toBe(probe.peer)
  })

  it.each([false, 0, [] as string[]])('treats %j like unset', async (value) => {
    const baseline = await request(buildApp()).get('/ssh/').set(FORWARDED_HTTPS)
    const res = await request(buildApp(value)).get('/ssh/').set(FORWARDED_HTTPS)
    expect(stableHeaders(res.headers)).toEqual(stableHeaders(baseline.headers))
    expect(cookieAttributes(res.headers)).toEqual(PLAIN_COOKIE_ATTRIBUTES)
  })
})

describe('http.trustProxy: true behind a TLS-terminating proxy', () => {
  it('sends HSTS, the strict CSP variant and a Secure cookie for X-Forwarded-Proto: https', async () => {
    const res = await request(buildApp(true)).get('/ssh/').set(FORWARDED_HTTPS)
    expect(res.status).toBe(200)
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains')
    expect(connectSrcOf(res.headers)).toBe(STRICT_CONNECT_SRC)
    expect(cookieAttributes(res.headers)).toEqual(SECURE_COOKIE_ATTRIBUTES)
    expect(socketUrlOf(res.text)).toMatch(/^https:\/\//)
  })

  it('derives req.ip and req.protocol from the forwarded headers', async () => {
    const probe = (await request(buildApp(true)).get('/probe').set(FORWARDED_HTTPS)).body as Probe
    expect(probe).toMatchObject({ ip: '203.0.113.7', protocol: 'https', secure: true })
  })

  it('keeps plain-HTTP behavior when the proxy forwards http', async () => {
    const res = await request(buildApp(true)).get('/ssh/').set('X-Forwarded-Proto', 'http')
    expect(res.headers['strict-transport-security']).toBeUndefined()
    expect(connectSrcOf(res.headers)).toBe(PLAIN_CONNECT_SRC)
    expect(cookieAttributes(res.headers)).toEqual(PLAIN_COOKIE_ATTRIBUTES)
  })
})

describe('http.trustProxy as a proxy address list', () => {
  it('ignores X-Forwarded-* headers from a peer that is not listed', async () => {
    const app = buildApp(['192.0.2.10'])
    const res = await request(app).get('/ssh/').set(FORWARDED_HTTPS)
    expect(res.headers['strict-transport-security']).toBeUndefined()
    expect(connectSrcOf(res.headers)).toBe(PLAIN_CONNECT_SRC)
    expect(cookieAttributes(res.headers)).toEqual(PLAIN_COOKIE_ATTRIBUTES)

    const probe = (await request(app).get('/probe').set(FORWARDED_HTTPS)).body as Probe
    expect(probe.secure).toBe(false)
    expect(probe.ip).toBe(probe.peer)
  })

  it.each([['loopback'], ['127.0.0.1'], ['127.0.0.0/8', '::1']])(
    'honors X-Forwarded-* headers from a listed peer (%j)',
    async (...list) => {
      const app = buildApp(list)
      const res = await request(app).get('/ssh/').set(FORWARDED_HTTPS)
      expect(res.headers['strict-transport-security']).toBeDefined()
      expect(cookieAttributes(res.headers)).toContain('Secure')

      const probe = (await request(app).get('/probe').set(FORWARDED_HTTPS)).body as Probe
      expect(probe).toMatchObject({ ip: '203.0.113.7', protocol: 'https', secure: true })
    }
  )
})

const withSso =
  (trustedProxies: string[]) =>
  (config: Config): void => {
    config.sso = { ...config.sso, enabled: true, csrfProtection: true, trustedProxies }
  }

// A cross-site credential POST: rejected by the origin check unless the SSO
// trusted-proxy bypass applies, so the status shows which way it went.
const CROSS_SITE_POST = { Origin: 'https://attacker.example', 'Sec-Fetch-Site': 'cross-site' }

describe('sso.trustedProxies with http.trustProxy set', () => {
  it('does not let X-Forwarded-For impersonate a trusted SSO proxy', async () => {
    const app = buildApp(true, withSso(['198.51.100.9']))
    const res = await request(app)
      .post('/ssh/')
      .set({ ...FORWARDED_HTTPS, ...CROSS_SITE_POST, 'X-Forwarded-For': '198.51.100.9' })
      .send({})
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Forbidden' })
  })

  it('still recognizes the connecting proxy by its own address', async () => {
    const peer = ((await request(buildApp(true)).get('/probe')).body as Probe).peer as string
    const app = buildApp(true, withSso([peer]))
    const res = await request(app)
      .post('/ssh/')
      .set({ ...FORWARDED_HTTPS, ...CROSS_SITE_POST })
      .send({})
    expect(res.status).not.toBe(403)
  })
})

describe('http.trustProxy values the schema accepts', () => {
  // Every value that passes config validation must also be accepted by
  // Express's `trust proxy` compiler, or the server fails at startup.
  it.each([
    [true],
    [1],
    [['10.0.0.0/8']], //NOSONAR - test fixture addresses
    [['0.0.0.0/1', '128.0.0.0/1']], //NOSONAR - test fixture addresses
    [['::/1', '8000::/1']], //NOSONAR - test fixture addresses
    [['10.0.0.1/32', '::1/128', 'fd00::/8', 'fe80::1%eth0']], //NOSONAR - test fixture addresses
    [['::ffff:10.0.0.0/104', '1.2.3.4', 'loopback', 'linklocal', 'uniquelocal']], //NOSONAR - test fixture addresses
  ])('starts the app with %j', (value) => {
    const secret: string = TEST_SESSION_SECRET_VALID
    const defaults = createDefaultConfig(secret)
    const fileConfig = { http: { origins: ['*:*'], trustProxy: value } } as Partial<Config>
    const result = processConfig(defaults, fileConfig)
    expect(result.ok).toBe(true)
    expect(() => result.ok && createAppAsync(result.value)).not.toThrow()
  })

  it.each([['0.0.0.0/0'], ['::/0']])('rejects %s in config validation', (entry) => {
    const secret: string = TEST_SESSION_SECRET_VALID
    const defaults = createDefaultConfig(secret)
    const fileConfig = { http: { origins: ['*:*'], trustProxy: [entry] } } as Partial<Config>
    expect(processConfig(defaults, fileConfig).ok).toBe(false)
  })
})
