// tests/unit/security-headers.vitest.ts
// Unit tests for the tightened, config-driven CSP builder

import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express, { type Application } from 'express'
import { buildCspDirectives, cspHeaderValue, createSecurityHeadersMiddleware } from '../../app/security-headers.js'
import * as connectSrc from '../../app/security/connect-src.js'
import type { Config, CspConfig } from '../../app/types/config.js'
import { HEADERS } from '../../app/constants/index.js'

// ---------------------------------------------------------------------------
// Config builder helpers
// ---------------------------------------------------------------------------

function makeCsp(over: Partial<CspConfig> = {}): CspConfig {
  return {
    mode: 'enforce',
    reportUri: '/ssh/csp-report',
    connectSrc: [],
    frameAncestors: ['none'],
    ...over,
  }
}

function makeConfig(over: Partial<Config> = {}): Config {
  return {
    listen: { ip: '0.0.0.0', port: 2222 },
    http: { origins: ['*:*'] },
    user: { name: null, password: null, privateKey: null, passphrase: null },
    ssh: {
      host: null,
      port: 22,
      term: 'xterm-256color',
      readyTimeout: 20_000,
      keepaliveInterval: 120_000,
      keepaliveCountMax: 10,
      alwaysSendKeyboardInteractivePrompts: false,
      disableInteractiveAuth: false,
      algorithms: { cipher: [], compress: [], hmac: [], kex: [], serverHostKey: [] },
      allowedAuthMethods: ['password', 'keyboard-interactive', 'publickey'],
      hostKeyVerification: {
        enabled: false,
        mode: 'server',
        unknownKeyAction: 'reject',
        serverStore: { enabled: true, dbPath: '' },
        clientStore: { enabled: false },
      },
    },
    header: { text: null, background: null },
    options: {
      challengeButton: false,
      autoLog: false,
      allowReauth: false,
      allowReconnect: false,
      allowReplay: false,
    },
    session: { secret: 'test-secret', name: 'webssh2.sid' },
    sso: {
      enabled: false,
      csrfProtection: false,
      trustedProxies: [],
      headerMapping: { username: 'x-user', password: 'x-pass', session: 'x-session' },
    },
    csp: makeCsp(),
    ...over,
  } as Config
}

// ---------------------------------------------------------------------------
// buildCspDirectives
// ---------------------------------------------------------------------------

describe('buildCspDirectives', () => {
  it("script-src is 'self' with no unsafe-inline", () => {
    expect(buildCspDirectives(makeConfig(), true)['script-src']).toEqual(["'self'"])
  })

  it("style-src keeps 'unsafe-inline' (xterm needs it)", () => {
    expect(buildCspDirectives(makeConfig(), true)['style-src']).toEqual(["'self'", "'unsafe-inline'"])
  })

  it("connect-src is 'self' only when CORS is wildcard", () => {
    expect(buildCspDirectives(makeConfig(), true)['connect-src']).toEqual(["'self'"])
  })

  it('connect-src folds in concrete origins + csp.connectSrc extras', () => {
    const cfg = makeConfig({
      http: { origins: ['gw.example:8443'] },
      csp: makeCsp({ connectSrc: ['https://x.example'] }),
    })
    const d = buildCspDirectives(cfg, true)
    expect(d['connect-src']).toContain('wss://gw.example:8443')
    expect(d['connect-src']).toContain('https://x.example')
  })

  it("base-uri 'none', object-src 'none'", () => {
    const d = buildCspDirectives(makeConfig(), true)
    expect(d['base-uri']).toEqual(["'none'"])
    expect(d['object-src']).toEqual(["'none'"])
  })

  it("frame-ancestors follows config (none -> 'none', self -> 'self', list verbatim)", () => {
    expect(
      buildCspDirectives(makeConfig(), true)['frame-ancestors']
    ).toEqual(["'none'"])

    expect(
      buildCspDirectives(makeConfig({ csp: makeCsp({ frameAncestors: ['self'] }) }), true)['frame-ancestors']
    ).toEqual(["'self'"])

    expect(
      buildCspDirectives(makeConfig({ csp: makeCsp({ frameAncestors: ['https://embed.example'] }) }), true)[
        'frame-ancestors'
      ]
    ).toEqual(['https://embed.example'])
  })

  it("empty frame-ancestors fails safe to 'none'", () => {
    const d = buildCspDirectives(makeConfig({ csp: makeCsp({ frameAncestors: [] }) }), true)
    expect(d['frame-ancestors']).toEqual(["'none'"])
  })

  it("empty frame-ancestors serializes to frame-ancestors 'none' (never a bare directive)", () => {
    const d = buildCspDirectives(makeConfig({ csp: makeCsp({ frameAncestors: [] }) }), true)
    const csp = cspHeaderValue(d)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toMatch(/frame-ancestors\s*(;|$)/)
  })

  it('includes report-uri and report-to when mode != off, absent when off', () => {
    const on = buildCspDirectives(makeConfig(), true)
    expect(on['report-uri']).toEqual(['/ssh/csp-report'])
    expect(on['report-to']).toEqual(['csp-endpoint'])

    const off = buildCspDirectives(makeConfig({ csp: makeCsp({ mode: 'off' }) }), true)
    expect(off['report-uri']).toBeUndefined()
    expect(off['report-to']).toBeUndefined()
  })

  it('includes report directives in report-only mode', () => {
    const d = buildCspDirectives(makeConfig({ csp: makeCsp({ mode: 'report-only' }) }), true)
    expect(d['report-uri']).toEqual(['/ssh/csp-report'])
    expect(d['report-to']).toEqual(['csp-endpoint'])
  })

  it('does not include ws:// sources when secure=true', () => {
    const cfg = makeConfig({
      http: { origins: ['host.example:8443'] },
      csp: makeCsp(),
    })
    const d = buildCspDirectives(cfg, true)
    expect(d['connect-src']).not.toContain('ws://host.example:8443')
    expect(d['connect-src']).not.toContain('http://host.example:8443')
  })

  it('includes ws:// and http:// sources when secure=false', () => {
    const cfg = makeConfig({
      http: { origins: ['host.example:8080'] },
      csp: makeCsp(),
    })
    const d = buildCspDirectives(cfg, false)
    expect(d['connect-src']).toContain('ws://host.example:8080')
    expect(d['connect-src']).toContain('http://host.example:8080')
  })
})

// ---------------------------------------------------------------------------
// cspHeaderValue
// ---------------------------------------------------------------------------

describe('cspHeaderValue', () => {
  it('serializes directives in order', () => {
    expect(
      cspHeaderValue({ 'default-src': ["'self'"], 'object-src': ["'none'"] })
    ).toBe("default-src 'self'; object-src 'none'")
  })

  it('handles multiple values per directive', () => {
    expect(
      cspHeaderValue({ 'connect-src': ["'self'", 'wss://example.com'] })
    ).toBe("connect-src 'self' wss://example.com")
  })
})

// ---------------------------------------------------------------------------
// Middleware integration (CSP header name + Reporting-Endpoints)
// ---------------------------------------------------------------------------

function makeApp(cfg: Config): Application {
  const app = express()
  app.use(createSecurityHeadersMiddleware(cfg))
  app.get('/ping', (_req, res) => {
    res.status(200).json({ ok: true })
  })
  return app
}

describe('createSecurityHeadersMiddleware CSP header selection', () => {
  it('mode=report-only → Content-Security-Policy-Report-Only present, not enforce header', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ mode: 'report-only' }) }))
    const res = await request(app).get('/ping')
    expect(res.headers[HEADERS.CONTENT_SECURITY_POLICY_REPORT_ONLY.toLowerCase()]).toBeDefined()
    expect(res.headers[HEADERS.CONTENT_SECURITY_POLICY.toLowerCase()]).toBeUndefined()
  })

  it('mode=report-only → Reporting-Endpoints header contains csp-endpoint', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ mode: 'report-only', reportUri: '/ssh/csp-report' }) }))
    const res = await request(app).get('/ping')
    const reportingHeader = res.headers[HEADERS.REPORTING_ENDPOINTS.toLowerCase()]
    expect(reportingHeader).toBeDefined()
    expect(reportingHeader).toContain('csp-endpoint=')
    expect(reportingHeader).toContain('/ssh/csp-report')
  })

  it('mode=enforce → Content-Security-Policy present, not report-only header', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ mode: 'enforce' }) }))
    const res = await request(app).get('/ping')
    expect(res.headers[HEADERS.CONTENT_SECURITY_POLICY.toLowerCase()]).toBeDefined()
    expect(res.headers[HEADERS.CONTENT_SECURITY_POLICY_REPORT_ONLY.toLowerCase()]).toBeUndefined()
  })

  it('mode=enforce → Reporting-Endpoints header present with csp-endpoint', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ mode: 'enforce', reportUri: '/ssh/csp-report' }) }))
    const res = await request(app).get('/ping')
    expect(res.headers[HEADERS.REPORTING_ENDPOINTS.toLowerCase()]).toBe('csp-endpoint="/ssh/csp-report"')
  })

  it('mode=off → neither CSP header present', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ mode: 'off' }) }))
    const res = await request(app).get('/ping')
    expect(res.headers[HEADERS.CONTENT_SECURITY_POLICY.toLowerCase()]).toBeUndefined()
    expect(res.headers[HEADERS.CONTENT_SECURITY_POLICY_REPORT_ONLY.toLowerCase()]).toBeUndefined()
  })

  it('mode=off → Reporting-Endpoints not present', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ mode: 'off' }) }))
    const res = await request(app).get('/ping')
    expect(res.headers[HEADERS.REPORTING_ENDPOINTS.toLowerCase()]).toBeUndefined()
  })

  it('tightened CSP does not contain unsafe-inline in script-src', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ mode: 'enforce' }) }))
    const res = await request(app).get('/ping')
    const csp = res.headers[HEADERS.CONTENT_SECURITY_POLICY.toLowerCase()] as string
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'))
    expect(scriptSrc).toBeDefined()
    expect(scriptSrc).not.toContain('unsafe-inline')
  })

  it('tightened CSP does not contain bare ws: or wss: wildcards in connect-src', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ mode: 'enforce' }) }))
    const res = await request(app).get('/ping')
    const csp = res.headers[HEADERS.CONTENT_SECURITY_POLICY.toLowerCase()] as string
    const connectDirective = csp.split(';').find((d) => d.trim().startsWith('connect-src'))
    expect(connectDirective).toBeDefined()
    // Should not have bare scheme wildcards like "ws:" or "wss:" without a host
    expect(connectDirective).not.toMatch(/\bwss?:\s/)
    expect(connectDirective).not.toMatch(/\bwss?:$/)
  })
})

// ---------------------------------------------------------------------------
// X-Frame-Options consistency with frame-ancestors
// ---------------------------------------------------------------------------

describe('X-Frame-Options derived from frame-ancestors', () => {
  it("frame-ancestors=['none'] → X-Frame-Options: DENY", async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ frameAncestors: ['none'] }) }))
    const res = await request(app).get('/ping')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })

  it("frame-ancestors=['self'] → X-Frame-Options: SAMEORIGIN", async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ frameAncestors: ['self'] }) }))
    const res = await request(app).get('/ping')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
  })

  it('frame-ancestors with explicit origin → X-Frame-Options omitted', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ frameAncestors: ['https://embed.example'] }) }))
    const res = await request(app).get('/ping')
    expect(res.headers['x-frame-options']).toBeUndefined()
  })

  it('empty frame-ancestors fails safe to X-Frame-Options: DENY', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ frameAncestors: [] }) }))
    const res = await request(app).get('/ping')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })
})

// ---------------------------------------------------------------------------
// SSO form-action adjustment
// ---------------------------------------------------------------------------

describe('SSO form-action adjustment', () => {
  it('appends https: to form-action when SSO enabled with trustedProxies', async () => {
    const cfg = makeConfig({
      sso: {
        enabled: true,
        csrfProtection: false,
        trustedProxies: ['10.0.0.0/8'],
        headerMapping: { username: 'x-user', password: 'x-pass', session: 'x-session' },
      },
    })
    const app = makeApp(cfg)
    const res = await request(app).get('/ping')
    const csp = res.headers[HEADERS.CONTENT_SECURITY_POLICY.toLowerCase()] as string
    const formAction = csp.split(';').find((d) => d.trim().startsWith('form-action'))
    expect(formAction).toContain("'self'")
    expect(formAction).toContain('https:')
  })

  it('form-action stays self-only when SSO disabled', async () => {
    const app = makeApp(makeConfig())
    const res = await request(app).get('/ping')
    const csp = res.headers[HEADERS.CONTENT_SECURITY_POLICY.toLowerCase()] as string
    const formAction = csp.split(';').find((d) => d.trim().startsWith('form-action'))
    expect(formAction).toContain("'self'")
    expect(formAction).not.toContain('https:')
  })
})

// ---------------------------------------------------------------------------
// Memoization guard: middleware does not rebuild CSP per request
// ---------------------------------------------------------------------------

describe('CSP memoization', () => {
  it('returns identical CSP string on successive requests (proves precomputed, not rebuilt)', async () => {
    const app = makeApp(makeConfig({ csp: makeCsp({ mode: 'enforce' }) }))
    const [r1, r2] = await Promise.all([request(app).get('/ping'), request(app).get('/ping')])
    const header = HEADERS.CONTENT_SECURITY_POLICY.toLowerCase()
    expect(r1.headers[header]).toBe(r2.headers[header])
  })

  // Spy on the cross-module dependency deriveConnectSrc (imported by
  // buildCspDirectives from ./security/connect-src.js) so vi.spyOn can
  // intercept it. Spying on the module's own buildCspDirectives would not work
  // because its internal call uses the local binding, not the module export.
  it('precomputes the CSP once at construction, never per-request', () => {
    const spy = vi.spyOn(connectSrc, 'deriveConnectSrc')
    try {
      const mw = createSecurityHeadersMiddleware(makeConfig({ csp: makeCsp({ mode: 'enforce' }) }))
      // Built once for secure=true and once for secure=false at construction.
      expect(spy).toHaveBeenCalledTimes(2)

      spy.mockClear()
      const res = { setHeader: vi.fn() } as unknown as Parameters<typeof mw>[1]
      const secureReq = { secure: true, method: 'GET', url: '/ping' } as unknown as Parameters<typeof mw>[0]
      const insecureReq = { secure: false, method: 'GET', url: '/ping' } as unknown as Parameters<typeof mw>[0]
      mw(secureReq, res, vi.fn())
      mw(insecureReq, res, vi.fn())
      // No rebuild per request — handler only reads closed-over strings.
      expect(spy).toHaveBeenCalledTimes(0)
    } finally {
      spy.mockRestore()
    }
  })
})
