// tests/integration/csp-report.vitest.ts
// Integration tests for the hardened POST /ssh/csp-report endpoint.
// Tests cover: content-type acceptance, legacy inline demotion flag, per-IP
// throttling (runs BEFORE body parsing), application/reports+json shape, and
// mode-gating via createRoutesV2.

import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { registerCspReportRoute } from '../../app/routes/handlers/csp-report-handler.js'
import { createRoutesV2 } from '../../app/routes/routes-v2.js'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import type { ExtractedCspReport } from '../../app/security/csp-report.js'
import { TEST_SESSION_SECRET_VALID } from '@tests/test-constants.js'

interface CapturedViolation {
  report: ExtractedCspReport
  meta: { isLegacy: boolean; clientIp?: string; userAgent?: string }
}

const DEFAULT_RATE_LIMIT = { capacity: 5, refillPerSec: 0, maxKeys: 100 }

const makeApp = (
  captured: CapturedViolation[],
  rl = DEFAULT_RATE_LIMIT
): express.Application => {
  const app = express()
  const router = express.Router()
  registerCspReportRoute(router, {
    rateLimit: rl,
    onViolation: (report, meta) => {
      captured.push({ report, meta })
    }
  })
  app.use('/ssh', router)
  return app
}

describe('POST /ssh/csp-report', () => {
  it('accepts application/csp-report, returns 204 + no-store, emits a populated violation', async () => {
    const captured: CapturedViolation[] = []
    const res = await request(makeApp(captured))
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(
        JSON.stringify({
          'csp-report': {
            'violated-directive': 'script-src',
            'blocked-uri': 'https://evil'
          }
        })
      )
    expect(res.status).toBe(204)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(captured).toHaveLength(1)
    expect(captured[0].report).toMatchObject({ directive: 'script-src', blockedUri: 'https://evil' })
    expect(captured[0].meta.isLegacy).toBe(false)
  })

  it('flags legacy inline violation (blocked-uri inline) as isLegacy=true', async () => {
    const captured: CapturedViolation[] = []
    await request(makeApp(captured))
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(
        JSON.stringify({
          'csp-report': {
            'violated-directive': 'script-src',
            'blocked-uri': 'inline',
            'script-sample': 'window.webssh2Config = null;'
          }
        })
      )
    expect(captured[0].meta.isLegacy).toBe(true)
  })

  it('flags legacy inline violation by script-sample alone (even without blocked-uri inline)', async () => {
    const captured: CapturedViolation[] = []
    await request(makeApp(captured))
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(
        JSON.stringify({
          'csp-report': {
            'violated-directive': 'script-src',
            'blocked-uri': 'https://cdn.example',
            'script-sample': 'window.webssh2Config ='
          }
        })
      )
    expect(captured[0].meta.isLegacy).toBe(true)
  })

  it('throttles repeated posts from one IP — emits no more than capacity, always 204', async () => {
    const captured: CapturedViolation[] = []
    const app = makeApp(captured, { capacity: 3, refillPerSec: 0, maxKeys: 100 })
    for (let i = 0; i < 8; i++) {
      const r = await request(app)
        .post('/ssh/csp-report')
        .set('Content-Type', 'application/csp-report')
        .send('{}')
      // Throttled requests are silently dropped — still 204 (not 429)
      expect(r.status).toBe(204)
      // Every response (allowed and throttled) carries Cache-Control: no-store
      expect(r.headers['cache-control']).toBe('no-store')
    }
    // No more than capacity (3) calls should reach onViolation
    expect(captured.length).toBeLessThanOrEqual(3)
  })

  it('rejects a body over 8 kb with 204 (not 413)', async () => {
    const bigBody = JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(9000) } })
    const res = await request(makeApp([]))
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(bigBody)
    expect(res.status).toBe(204)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('accepts application/reports+json (Reporting API shape)', async () => {
    const captured: CapturedViolation[] = []
    await request(makeApp(captured))
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/reports+json')
      .send(
        JSON.stringify({
          body: { effectiveDirective: 'img-src', blockedURL: 'https://x' }
        })
      )
    expect(captured[0].report).toMatchObject({ directive: 'img-src', blockedUri: 'https://x' })
  })

  it('returns 204 + no-store even for an empty body', async () => {
    const captured: CapturedViolation[] = []
    const res = await request(makeApp(captured))
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send('{}')
    expect(res.status).toBe(204)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(captured).toHaveLength(1)
    expect(captured[0].report).toEqual({})
  })
})

describe('createRoutesV2 csp-report registration (mode gating)', () => {
  it('registers /ssh/csp-report when mode != off and 404s when mode == off', async () => {
    const secret: string = TEST_SESSION_SECRET_VALID
    const base = createDefaultConfig(secret)

    // Mode report-only → endpoint should exist
    const onApp = express()
    onApp.use('/ssh', createRoutesV2({ ...base, csp: { ...base.csp, mode: 'report-only' } }))
    const onRes = await request(onApp)
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send('{}')
    expect(onRes.status).toBe(204)

    // Mode off → endpoint must not be registered
    const offApp = express()
    offApp.use('/ssh', createRoutesV2({ ...base, csp: { ...base.csp, mode: 'off' } }))
    const offRes = await request(offApp)
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send('{}')
    expect(offRes.status).toBe(404)
  })

  it('registers /ssh/csp-report when mode == enforce', async () => {
    const secret: string = TEST_SESSION_SECRET_VALID
    const base = createDefaultConfig(secret)

    const enforceApp = express()
    enforceApp.use('/ssh', createRoutesV2({ ...base, csp: { ...base.csp, mode: 'enforce' } }))
    const enforceRes = await request(enforceApp)
      .post('/ssh/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send('{}')
    expect(enforceRes.status).toBe(204)
  })
})
