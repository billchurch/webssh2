// tests/integration/static-cache-headers.vitest.ts
// Verifies Cache-Control policy on the express.static asset mounts
//
// Depends on node_modules/webssh2_client/client/public existing, which is
// guaranteed by `npm install` (webssh2_client is a runtime dependency).

import fs from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Application } from 'express'
import { createAppAsync } from '../../app/app.js'
import { getClientPublicPath } from '../../app/client-path.js'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import { TELNET_DEFAULTS } from '../../app/constants/index.js'
import { TEST_SESSION_SECRET_VALID } from '@tests/test-constants.js'
import {
  cacheControlForAsset,
  CACHE_CONTROL_HTML,
} from '../../app/utils/static-cache.js'
import type { Config } from '../../app/types/config.js'

// The bundled client may ship either content-hashed filenames (Vite's
// `webssh2-<hash>.js`, current in 5.1.0+) or stable names (`webssh2.bundle.js`,
// older builds). Discover the actual names at runtime so the test stays correct
// regardless of which the installed client produces, and derive each name's
// expected Cache-Control from the same policy the server applies.
const JS_BUNDLE_PATTERN = /^webssh2-.*\.js$/
const CSS_PATTERN = /^webssh2-.*\.css$/

function findAsset(pattern: RegExp, fallback: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- app-resolved public dir
  const files: string[] = fs.readdirSync(getClientPublicPath())
  const match = files.find((file) => pattern.test(file))
  return match ?? fallback
}

function createTestConfig(): Config {
  const secret: string = TEST_SESSION_SECRET_VALID
  const config: Config = createDefaultConfig(secret)
  config.telnet = {
    enabled: true,
    defaultPort: TELNET_DEFAULTS.PORT,
    timeout: TELNET_DEFAULTS.TIMEOUT_MS,
    term: TELNET_DEFAULTS.TERM,
    auth: {
      loginPrompt: TELNET_DEFAULTS.LOGIN_PROMPT,
      passwordPrompt: TELNET_DEFAULTS.PASSWORD_PROMPT,
      failurePattern: TELNET_DEFAULTS.FAILURE_PATTERN,
      expectTimeout: TELNET_DEFAULTS.EXPECT_TIMEOUT_MS,
    },
    allowedSubnets: [],
  }
  return config
}

describe('static asset cache headers', () => {
  let app: Application
  let bundleName: string
  let cssName: string
  let bundleCacheControl: string
  let cssCacheControl: string

  beforeAll(() => {
    bundleName = findAsset(JS_BUNDLE_PATTERN, 'webssh2.bundle.js')
    cssName = findAsset(CSS_PATTERN, 'webssh2.css')
    bundleCacheControl = cacheControlForAsset(bundleName)
    cssCacheControl = cacheControlForAsset(cssName)
    const config = createTestConfig()
    app = createAppAsync(config).app
  })

  it('serves the bundle with the policy cache header and an ETag', async () => {
    const res = await request(app).get(`/ssh/assets/${bundleName}`)
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(bundleCacheControl)
    expect(res.headers['etag']).toBeDefined()
  })

  it('serves stylesheets with the policy cache header', async () => {
    const res = await request(app).get(`/ssh/assets/${cssName}`)
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(cssCacheControl)
  })

  it('serves raw client.htm with no-cache', async () => {
    const res = await request(app).get('/ssh/assets/client.htm')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(CACHE_CONTROL_HTML)
  })

  it('applies the same policy on the telnet assets mount', async () => {
    const res = await request(app).get(`/telnet/assets/${bundleName}`)
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(bundleCacheControl)
    expect(res.headers['etag']).toBeDefined()
  })

  it('serves the dynamic client HTML with no-store', async () => {
    const res = await request(app).get('/ssh/')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('answers conditional requests with 304 when the ETag matches', async () => {
    const first = await request(app).get(`/ssh/assets/${bundleName}`)
    const etag = first.headers['etag']
    expect(etag).toBeDefined()

    const second = await request(app)
      .get(`/ssh/assets/${bundleName}`)
      .set('If-None-Match', etag as string)
    expect(second.status).toBe(304)
  })
})
