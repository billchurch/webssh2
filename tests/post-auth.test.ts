// tests/post-auth.test.ts
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing -- supertest types cause false positives with ESLint parser */

import { describe, it, expect } from 'vitest'
import express from 'express'
import request, { type Test, type Response } from 'supertest'
import session from 'express-session'
import { createRoutesV2 as createRoutes } from '../dist/app/routes/routes-v2.js'
import { createBodyParserMiddleware } from '../dist/app/middleware.js'
import { TEST_SECRET, SSO_HEADERS, TEST_USERNAME, TEST_PASSWORD, SSO_TEST_VALUES, TEST_FORM_DATA } from './test-constants.js'

// Mock configuration for testing
const mockConfig = {
  ssh: {
    host: 'test.example.com',
    port: 22,
    term: 'xterm-256color',
  },
  user: {
    name: null,
    password: null,
  },
  session: {
    secret: TEST_SECRET,
    name: 'test.sid',
  },
  sso: {
    enabled: true,
    csrfProtection: false,
    trustedProxies: ['127.0.0.1'],
    headerMapping: SSO_HEADERS,
  },
}

// Helper to create test app
function createTestApp(config = mockConfig): express.Application {
  const app = express()

  // Add session middleware
  app.use(
    session({
      secret: config.session.secret,
      resave: false,
      saveUninitialized: true,
      name: config.session.name,
    })
  )

  // Add body parser
  app.use(createBodyParserMiddleware())

  // Add routes
  const routes = createRoutes(config)
  app.use('/ssh', routes)

  return app
}

// Helper to assert HTML response
function assertHTMLResponse(response: Response, _message = 'Should return HTML content'): void {
  const hasDoctype = response.text.includes('<!DOCTYPE html')
  const hasHtml = response.text.includes('<html')
  expect(hasDoctype || hasHtml).toBeTruthy()
}

// Helper to create authenticated POST request
function createAuthenticatedPOST(app: express.Application, endpoint: string, formData: string, headers: Record<string, string> = {}): Test {
  const req: Test = request(app).post(endpoint).set('Content-Type', 'application/x-www-form-urlencoded')

  // Add custom headers
  Object.entries(headers).forEach(([key, value]) => {
    req.set(key, value)
  })

  return req.send(formData)
}

// Test data fixtures
const testCredentials = {
  form: TEST_FORM_DATA.basic,
  apmHeaders: {
    [SSO_HEADERS.username]: SSO_TEST_VALUES.username,
    [SSO_HEADERS.password]: SSO_TEST_VALUES.password,
  },
  basicAuth: Buffer.from(`${TEST_USERNAME}:${TEST_PASSWORD}`).toString('base64'),
}

const testHosts = {
  default: 'server.example.com',
  specific: 'myserver.example.com',
  apm: 'apm.example.com',
}

describe('POST /ssh/host/', () => {
  it('should authenticate with form data', async () => {
    const app = createTestApp()

    const response = await createAuthenticatedPOST(
      app,
      '/ssh/host/',
      `${testCredentials.form}&host=${testHosts.default}&port=22`
    ).expect(200)

    assertHTMLResponse(response)
  })

  it('should authenticate with APM headers', async () => {
    const app = createTestApp()

    const response = await createAuthenticatedPOST(
      app,
      '/ssh/host/',
      `host=${testHosts.apm}`,
      testCredentials.apmHeaders
    ).expect(200)

    assertHTMLResponse(response)
  })

  it('should fail without credentials', async () => {
    const app = createTestApp()

    await createAuthenticatedPOST(app, '/ssh/host/', `host=${testHosts.default}`).expect(401)
  })

  it('should handle custom header parameters', async () => {
    const app = createTestApp()

    const response = await createAuthenticatedPOST(
      app,
      '/ssh/host/',
      `${testCredentials.form}&host=${testHosts.default}` +
        '&header.name=Production%20Server&header.background=red&header.color=white'
    ).expect(200)

    assertHTMLResponse(response)
  })

  it('should handle session recording parameters', async () => {
    const app = createTestApp()

    const response = await createAuthenticatedPOST(
      app,
      '/ssh/host/',
      `${testCredentials.form}&host=${testHosts.default}` +
        '&allowreplay=true&mrhsession=session123&readyTimeout=30000'
    ).expect(200)

    assertHTMLResponse(response)
  })

  it('should prefer POST body over APM headers', async () => {
    const app = createTestApp()

    const response = await createAuthenticatedPOST(
      app,
      '/ssh/host/',
      `username=formuser&password=formpass&host=${testHosts.default}`,
      testCredentials.apmHeaders
    ).expect(200)

    assertHTMLResponse(response)
  })

  it('should handle environment variables', async () => {
    const app = createTestApp()

    const response = await createAuthenticatedPOST(
      app,
      '/ssh/host/',
      `${testCredentials.form}&host=${testHosts.default}` + '&env=TERM%3Dxterm%26LANG%3Den_US.UTF-8'
    ).expect(200)

    assertHTMLResponse(response)
  })
})

describe('POST /ssh/host/:host', () => {
  it('should authenticate with specific host', async () => {
    const app = createTestApp()

    const response = await createAuthenticatedPOST(
      app,
      `/ssh/host/${testHosts.specific}`,
      `${testCredentials.form}&port=2222`
    ).expect(200)

    assertHTMLResponse(response)
  })

  it('should validate host parameter', async () => {
    const app = createTestApp()

    await createAuthenticatedPOST(app, '/ssh/host/../../etc/passwd', testCredentials.form).expect(404)
  })
})

describe('GET routes', () => {
  it('should still work with Basic Auth', async () => {
    const app = createTestApp()

    const response = await request(app)
      .get(`/ssh/host/${testHosts.default}`)
      .set('Authorization', `Basic ${testCredentials.basicAuth}`)
      .expect(200)

    assertHTMLResponse(response)
  })
})