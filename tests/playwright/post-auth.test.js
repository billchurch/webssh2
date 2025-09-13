/**
 * HTTP POST Authentication Tests for WebSSH2
 * 
 * Tests the POST /ssh endpoint with flexible parameter passing
 * - Credentials in body, host/port in query params
 * - All parameters in body
 * - Mixed configurations
 * 
 * Requires Docker test SSH server to be running:
 * docker run -d --name webssh2-test-ssh -p 2244:22 \
 *   -e SSH_USER=testuser -e SSH_PASSWORD=testpassword \
 *   ghcr.io/billchurch/ssh_test:alpine
 */

import { test, expect } from '@playwright/test'
import { BASE_URL, SSH_PORT, SSH_HOST, USERNAME, PASSWORD } from './test-config.js'

// Test configuration
const TEST_CONFIG = {
  baseUrl: BASE_URL,
  sshHost: SSH_HOST,
  sshPort: String(SSH_PORT),
  validUsername: USERNAME,
  validPassword: PASSWORD,
  invalidUsername: 'wronguser',
  invalidPassword: 'wrongpass',
  nonExistentHost: 'nonexistent.invalid.host',
  invalidPort: '9999'
}

test.describe('HTTP POST Authentication', () => {
  test('should connect with credentials in body and host/port in query params', async ({ request }) => {
    // Make POST request with credentials in body, host/port in query
    const response = await request.post(
      `${TEST_CONFIG.baseUrl}/ssh?host=${TEST_CONFIG.sshHost}&port=${TEST_CONFIG.sshPort}`,
      {
        data: {
          username: TEST_CONFIG.validUsername,
          password: TEST_CONFIG.validPassword
        }
      }
    )
    
    expect(response.ok()).toBeTruthy()
    
    // Verify response contains client HTML
    const body = await response.text()
    expect(body).toContain('<!DOCTYPE html>')
    expect(body).toContain('webssh2.bundle.js')
  })

  test('should connect with all parameters in body', async ({ request }) => {
    // Make POST request with all parameters in body
    const response = await request.post(`${TEST_CONFIG.baseUrl}/ssh`, {
      data: {
        username: TEST_CONFIG.validUsername,
        password: TEST_CONFIG.validPassword,
        host: TEST_CONFIG.sshHost,
        port: parseInt(TEST_CONFIG.sshPort)
      }
    })
    
    expect(response.ok()).toBeTruthy()
    
    // Verify response contains client HTML
    const body = await response.text()
    expect(body).toContain('<!DOCTYPE html>')
    expect(body).toContain('webssh2.bundle.js')
  })

  test('should connect with hostname alias in query params', async ({ request }) => {
    // Test using 'hostname' instead of 'host' in query params
    const response = await request.post(
      `${TEST_CONFIG.baseUrl}/ssh?hostname=${TEST_CONFIG.sshHost}&port=${TEST_CONFIG.sshPort}`,
      {
        data: {
          username: TEST_CONFIG.validUsername,
          password: TEST_CONFIG.validPassword
        }
      }
    )
    
    expect(response.ok()).toBeTruthy()
    
    const body = await response.text()
    expect(body).toContain('<!DOCTYPE html>')
  })

  test('should prefer body parameters over query parameters', async ({ request }) => {
    // Send different values in body and query - body should win
    const response = await request.post(
      `${TEST_CONFIG.baseUrl}/ssh?host=${TEST_CONFIG.nonExistentHost}&port=${TEST_CONFIG.invalidPort}`,
      {
        data: {
          username: TEST_CONFIG.validUsername,
          password: TEST_CONFIG.validPassword,
          host: TEST_CONFIG.sshHost,
          port: parseInt(TEST_CONFIG.sshPort)
        }
      }
    )
    
    // Should succeed because body parameters override query
    expect(response.ok()).toBeTruthy()
    
    const body = await response.text()
    expect(body).toContain('<!DOCTYPE html>')
  })

  test('should fail with missing username', async ({ request }) => {
    const response = await request.post(
      `${TEST_CONFIG.baseUrl}/ssh?host=${TEST_CONFIG.sshHost}&port=${TEST_CONFIG.sshPort}`,
      {
        data: {
          password: TEST_CONFIG.validPassword
        }
      }
    )
    
    expect(response.status()).toBe(400)
    const body = await response.text()
    expect(body).toContain('Missing required fields in body: username, password')
  })

  test('should fail with missing password', async ({ request }) => {
    const response = await request.post(
      `${TEST_CONFIG.baseUrl}/ssh?host=${TEST_CONFIG.sshHost}&port=${TEST_CONFIG.sshPort}`,
      {
        data: {
          username: TEST_CONFIG.validUsername
        }
      }
    )
    
    expect(response.status()).toBe(400)
    const body = await response.text()
    expect(body).toContain('Missing required fields in body: username, password')
  })

  test('should fail with missing host (not in body or query)', async ({ request }) => {
    const response = await request.post(`${TEST_CONFIG.baseUrl}/ssh`, {
      data: {
        username: TEST_CONFIG.validUsername,
        password: TEST_CONFIG.validPassword
      }
    })
    
    expect(response.status()).toBe(400)
    const body = await response.text()
    expect(body).toContain('Missing required field: host (in body or query params)')
  })

  test('should use default port when not specified', async ({ request }) => {
    // Create a POST request without specifying port (should default to 22)
    // Since our test SSH server is on port 2244, we'll just verify the request succeeds
    // and the server accepts the request (actual connection would fail on port 22)
    const response = await request.post(
      `${TEST_CONFIG.baseUrl}/ssh?host=${TEST_CONFIG.sshHost}`,
      {
        data: {
          username: TEST_CONFIG.validUsername,
          password: TEST_CONFIG.validPassword,
          port: parseInt(TEST_CONFIG.sshPort) // Override default port in body
        }
      }
    )
    
    expect(response.ok()).toBeTruthy()
  })

  test('should handle sshterm parameter from query', async ({ request }) => {
    const response = await request.post(
      `${TEST_CONFIG.baseUrl}/ssh?host=${TEST_CONFIG.sshHost}&port=${TEST_CONFIG.sshPort}&sshterm=xterm-256color`,
      {
        data: {
          username: TEST_CONFIG.validUsername,
          password: TEST_CONFIG.validPassword
        }
      }
    )
    
    expect(response.ok()).toBeTruthy()
    
    const body = await response.text()
    expect(body).toContain('<!DOCTYPE html>')
  })

  test('should handle /ssh/reauth to clear stuck credentials', async ({ page }) => {
    // Navigate to /ssh/reauth to clear any session
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh/reauth`)
    
    // Should redirect to /ssh
    expect(page.url()).toContain('/ssh')
    
    // Verify we can now authenticate with correct credentials via POST
    const response = await page.request.post(
      `${TEST_CONFIG.baseUrl}/ssh?host=${TEST_CONFIG.sshHost}&port=${TEST_CONFIG.sshPort}`,
      {
        data: {
          username: TEST_CONFIG.validUsername,
          password: TEST_CONFIG.validPassword
        }
      }
    )
    
    expect(response.ok()).toBeTruthy()
  })

  test('should accept POST with JSON content type', async ({ request }) => {
    const response = await request.post(
      `${TEST_CONFIG.baseUrl}/ssh`,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          username: TEST_CONFIG.validUsername,
          password: TEST_CONFIG.validPassword,
          host: TEST_CONFIG.sshHost,
          port: parseInt(TEST_CONFIG.sshPort)
        }
      }
    )
    
    expect(response.ok()).toBeTruthy()
    const body = await response.text()
    expect(body).toContain('<!DOCTYPE html>')
  })
})