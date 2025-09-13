import { test, expect } from '@playwright/test'
import { BASE_URL, SSH_HOST, SSH_PORT, USERNAME, PASSWORD } from './constants.js'

test('Debug what text is on page after connection', async ({ page }) => {
  await page.goto(`${BASE_URL}/ssh`)
  
  // Fill in the form
  await page.fill('[name="host"]', SSH_HOST)
  await page.fill('[name="port"]', String(SSH_PORT))
  await page.fill('[name="username"]', USERNAME)
  await page.fill('[name="password"]', PASSWORD)

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
  const hasHostPort = allText.includes(`${SSH_HOST}:${SSH_PORT}`)
  console.log(`Page contains "${SSH_HOST}:${SSH_PORT}":`, hasHostPort)
})