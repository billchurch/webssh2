// tests/integration/csp-headers.vitest.ts
// Verifies CSP middleware behavior end-to-end across routes and delivery modes.
// Red-team coverage: S5 (CSP bypass) / A2 (security misconfiguration).

import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import type { Application } from 'express'
import { createAppAsync } from '../../app/app.js'
import { getClientPublicPath } from '../../app/client-path.js'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import { TEST_SESSION_SECRET_VALID } from '@tests/test-constants.js'
import type { Config } from '../../app/types/config.js'

// Discover the content-hashed bundle filename at runtime so the test stays
// correct regardless of which Vite build the installed client produces.
const JS_BUNDLE_PATTERN = /^webssh2-.*\.js$/

function findAsset(pattern: RegExp, fallback: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- app-resolved public dir
  const files: string[] = fs.readdirSync(getClientPublicPath())
  const match = files.find((file) => pattern.test(file))
  return match ?? fallback
}

function appFor(mode: 'off' | 'report-only' | 'enforce'): Application {
  const secret: string = TEST_SESSION_SECRET_VALID
  const config: Config = createDefaultConfig(secret)
  config.csp = { mode, reportUri: '/ssh/csp-report', connectSrc: [], frameAncestors: ['none'] }
  return createAppAsync(config).app
}

/** Isolate the script-src directive from a full CSP header value. */
function scriptSrcOf(csp: string): string {
  return csp.split('; ').find((d) => d.startsWith('script-src ')) ?? ''
}

describe('CSP headers', () => {
  // Express 5's built-in finalhandler adds its own `default-src 'none'` CSP on
  // unmatched-route 404 responses, overwriting whatever app-level middleware set.
  // The byte-identical assertion therefore covers only routes handled by the
  // application routers, where the security-headers middleware output is preserved.
  it('emits a byte-identical CSP across the asset and config routes (enforce)', async () => {
    const app = appFor('enforce')
    const bundle = findAsset(JS_BUNDLE_PATTERN, 'webssh2.bundle.js')
    // Both paths are fast: the asset path returns a static file immediately;
    // /ssh/config returns a JSON blob without initiating any SSH connection.
    const paths = [`/ssh/assets/${bundle}`, '/ssh/config']
    const headers = await Promise.all(
      paths.map((p) =>
        request(app)
          .get(p)
          .then((r) => r.headers['content-security-policy'])
      )
    )
    const defined = headers.filter((h): h is string => h !== undefined)
    expect(defined.length).toBe(paths.length)  // every app-handled route carries it
    expect(new Set(defined).size).toBe(1)       // value is identical across routes
    expect(scriptSrcOf(defined[0])).toBe("script-src 'self'")
    expect(defined[0]).toContain("base-uri 'none'")
  })

  it("uses Report-Only header + Reporting-Endpoints in 'report-only' mode", async () => {
    const res = await request(appFor('report-only')).get('/ssh/config')
    expect(res.headers['content-security-policy-report-only']).toBeDefined()
    expect(res.headers['content-security-policy']).toBeUndefined()
    expect(res.headers['reporting-endpoints']).toContain('csp-endpoint="/ssh/csp-report"')
  })

  it("emits no CSP header when mode is 'off'", async () => {
    const res = await request(appFor('off')).get('/ssh/config')
    expect(res.headers['content-security-policy']).toBeUndefined()
    expect(res.headers['content-security-policy-report-only']).toBeUndefined()
  })
})
