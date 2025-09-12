import { test, expect } from '@playwright/test'

const TEST_CONFIG = {
  sshHost: 'localhost',
  sshPort: '2244',
  validUsername: 'testuser',
  validPassword: 'testpassword'
}

test('Debug what text is on page after connection', async ({ page }) => {
  await page.goto('http://localhost:2222/ssh')
  
  // Fill in the form
  await page.fill('[name="host"]', TEST_CONFIG.sshHost)
  await page.fill('[name="port"]', TEST_CONFIG.sshPort)
  await page.fill('[name="username"]', TEST_CONFIG.validUsername)
  await page.fill('[name="password"]', TEST_CONFIG.validPassword)

  // Click connect
  await page.click('button:has-text("Connect")')
  
  // Wait for connection
  await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
  
  // Capture all text content
  const allText = await page.evaluate(() => document.body.textContent || '')
  console.log('All text on page:', allText)
  
  // Check if any text contains ssh://
  const hasSSHUrl = allText.includes('ssh://')
  console.log('Page contains "ssh://":', hasSSHUrl)
  
  // Check if any text contains localhost:2244
  const hasHostPort = allText.includes('localhost:2244')
  console.log('Page contains "localhost:2244":', hasHostPort)
})