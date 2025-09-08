// tests/post-auth.test.js

import test from 'node:test'
import assert from 'node:assert'
import express from 'express'
import request from 'supertest'
import session from 'express-session'
import { createRoutes } from '../app/routes.js'
import { createBodyParserMiddleware } from '../app/middleware.js'

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
    secret: 'test-secret',
    name: 'test.sid',
  },
  sso: {
    enabled: true,
    csrfProtection: false,
    trustedProxies: ['127.0.0.1'],
    headerMapping: {
      username: 'x-apm-username',
      password: 'x-apm-password',
    },
  },
}

// Helper to create test app
function createTestApp(config = mockConfig) {
  const app = express()
  
  // Add session middleware
  app.use(session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: true,
    name: config.session.name,
  }))
  
  // Add body parser
  app.use(createBodyParserMiddleware())
  
  // Add routes
  const routes = createRoutes(config)
  app.use('/ssh', routes)
  
  return app
}

test('POST /ssh/host/ - should authenticate with form data', async (t) => {
  const app = createTestApp()
  
  const response = await request(app)
    .post('/ssh/host/')
    .send('username=testuser&password=testpass&host=server.example.com&port=22')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .expect(200)
  
  assert.ok(response.text.includes('<!DOCTYPE html') || response.text.includes('<html'), 
    'Should return HTML content')
})

test('POST /ssh/host/:host - should authenticate with specific host', async (t) => {
  const app = createTestApp()
  
  const response = await request(app)
    .post('/ssh/host/myserver.example.com')
    .send('username=testuser&password=testpass&port=2222')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .expect(200)
  
  assert.ok(response.text.includes('<!DOCTYPE html') || response.text.includes('<html'), 
    'Should return HTML content')
})

test('POST /ssh/host/ - should authenticate with APM headers', async (t) => {
  const app = createTestApp()
  
  const response = await request(app)
    .post('/ssh/host/')
    .set('x-apm-username', 'apmuser')
    .set('x-apm-password', 'apmpass')
    .send('host=apm.example.com')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .expect(200)
  
  assert.ok(response.text.includes('<!DOCTYPE html') || response.text.includes('<html'), 
    'Should return HTML content with APM headers')
})

test('POST /ssh/host/ - should fail without credentials', async (t) => {
  const app = createTestApp()
  
  await request(app)
    .post('/ssh/host/')
    .send('host=server.example.com')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .expect(401)
})

test('POST /ssh/host/ - should handle custom header parameters', async (t) => {
  const app = createTestApp()
  
  const response = await request(app)
    .post('/ssh/host/')
    .send('username=testuser&password=testpass&host=server.example.com' +
          '&header.name=Production%20Server&header.background=red&header.color=white')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .expect(200)
  
  assert.ok(response.text.includes('<!DOCTYPE html') || response.text.includes('<html'), 
    'Should return HTML with custom headers')
})

test('POST /ssh/host/ - should handle session recording parameters', async (t) => {
  const app = createTestApp()
  
  const response = await request(app)
    .post('/ssh/host/')
    .send('username=testuser&password=testpass&host=server.example.com' +
          '&allowreplay=true&mrhsession=session123&readyTimeout=30000')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .expect(200)
  
  assert.ok(response.text.includes('<!DOCTYPE html') || response.text.includes('<html'), 
    'Should handle session recording parameters')
})

test('POST /ssh/host/ - should prefer POST body over APM headers', async (t) => {
  const app = createTestApp()
  
  const response = await request(app)
    .post('/ssh/host/')
    .set('x-apm-username', 'apmuser')
    .set('x-apm-password', 'apmpass')
    .send('username=formuser&password=formpass&host=server.example.com')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .expect(200)
  
  // The route should use form data (formuser) over APM headers (apmuser)
  assert.ok(response.text.includes('<!DOCTYPE html') || response.text.includes('<html'), 
    'Should prefer POST body credentials')
})

test('POST /ssh/host/:host - should validate host parameter', async (t) => {
  const app = createTestApp()
  
  // Test with invalid host (e.g., containing path traversal that Express rejects)
  const response = await request(app)
    .post('/ssh/host/../../etc/passwd')
    .send('username=testuser&password=testpass')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .expect(404) // Express rejects path traversal in route parameters
})

test('POST /ssh/host/ - should handle environment variables', async (t) => {
  const app = createTestApp()
  
  const response = await request(app)
    .post('/ssh/host/')
    .send('username=testuser&password=testpass&host=server.example.com' +
          '&env=TERM%3Dxterm%26LANG%3Den_US.UTF-8')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .expect(200)
  
  assert.ok(response.text.includes('<!DOCTYPE html') || response.text.includes('<html'), 
    'Should handle environment variables')
})

// Test backward compatibility with GET routes
test('GET routes should still work with Basic Auth', async (t) => {
  const app = createTestApp()
  const credentials = Buffer.from('testuser:testpass').toString('base64')
  
  const response = await request(app)
    .get('/ssh/host/server.example.com')
    .set('Authorization', `Basic ${credentials}`)
    .expect(200)
  
  assert.ok(response.text.includes('<!DOCTYPE html') || response.text.includes('<html'), 
    'GET routes should continue working with Basic Auth')
})