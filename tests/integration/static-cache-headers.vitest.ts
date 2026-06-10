// tests/integration/static-cache-headers.vitest.ts
// Verifies Cache-Control policy on the express.static asset mounts
//
// Depends on node_modules/webssh2_client/client/public existing, which is
// guaranteed by `npm install` (webssh2_client is a runtime dependency).

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Application } from 'express'
import { createAppAsync } from '../../app/app.js'
import { getClientPublicPath } from '../../app/client-path.js'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import { TELNET_DEFAULTS } from '../../app/constants/index.js'
import { TEST_SESSION_SECRET_VALID } from '@tests/test-constants.js'
import {
  CACHE_CONTROL_HTML,
  CACHE_CONTROL_STABLE,
} from '../../app/utils/static-cache.js'
import type { Config } from '../../app/types/config.js'

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

  beforeAll(() => {
    const bundlePath = join(getClientPublicPath(), 'webssh2.bundle.js')
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test prerequisite check on app-resolved path
    if (!existsSync(bundlePath)) {
      throw new Error(
        `Client bundle not found at ${bundlePath}. ` +
          'These tests require the webssh2_client public assets ' +
          '(run `npm install`, or build the client if using npm link).'
      )
    }
    const config = createTestConfig()
    app = createAppAsync(config).app
  })

  it('serves the bundle with short public caching and an ETag', async () => {
    const res = await request(app).get('/ssh/assets/webssh2.bundle.js')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(CACHE_CONTROL_STABLE)
    expect(res.headers['etag']).toBeDefined()
  })

  it('serves stylesheets with short public caching', async () => {
    const res = await request(app).get('/ssh/assets/webssh2.css')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(CACHE_CONTROL_STABLE)
  })

  it('serves raw client.htm with no-cache', async () => {
    const res = await request(app).get('/ssh/assets/client.htm')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(CACHE_CONTROL_HTML)
  })

  it('applies the same policy on the telnet assets mount', async () => {
    const res = await request(app).get('/telnet/assets/webssh2.bundle.js')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(CACHE_CONTROL_STABLE)
    expect(res.headers['etag']).toBeDefined()
  })

  it('serves the dynamic client HTML with no-store', async () => {
    const res = await request(app).get('/ssh/')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('answers conditional requests with 304 when the ETag matches', async () => {
    const first = await request(app).get('/ssh/assets/webssh2.bundle.js')
    const etag = first.headers['etag']
    expect(etag).toBeDefined()

    const second = await request(app)
      .get('/ssh/assets/webssh2.bundle.js')
      .set('If-None-Match', etag as string)
    expect(second.status).toBe(304)
  })
})
