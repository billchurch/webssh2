/**
 * WebSocket Performance Tests for WebSSH2
 *
 * Tests WebSocket performance, throughput, and stability
 */

import { test, expect } from '@playwright/test'
import { BASE_URL, SSH_HOST, SSH_PORT, USERNAME, PASSWORD, TIMEOUTS, TERMINAL } from './constants.js'

// Helper to establish connection
async function establishConnection(page) {
  await page.goto(`${BASE_URL}/ssh`)
  await page.fill('[name="host"]', SSH_HOST)
  await page.fill('[name="port"]', String(SSH_PORT))
  await page.fill('[name="username"]', USERNAME)
  await page.fill('[name="password"]', PASSWORD)
  await page.click('button:has-text("Connect")')
  await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
}

test.describe('WebSocket Performance', () => {
  test('should handle large data transfer', async ({ page }) => {
    await establishConnection(page)

    // Wait for prompt - match various shell prompts
    // Wait for the prompt in the actual terminal content, not the measure element
    await page.waitForFunction(
      () => {
        const terminalContent = document.querySelector('.xterm-rows')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    // Generate and display large output
    const terminal = page.getByRole(TERMINAL.INPUT_SELECTOR, { name: TERMINAL.INPUT_NAME })

    // Test with a command that generates substantial output
    await terminal.fill('seq 1 1000')
    await terminal.press('Enter')

    // Verify some of the output is visible
    await expect(page.locator('text=500')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    await expect(page.locator('text=1000')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
  })

  test('should handle rapid command execution', async ({ page }) => {
    await establishConnection(page)
    // Wait for the prompt in the actual terminal content, not the measure element
    await page.waitForFunction(
      () => {
        const terminalContent = document.querySelector('.xterm-rows')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    const terminal = page.getByRole(TERMINAL.INPUT_SELECTOR, { name: TERMINAL.INPUT_NAME })

    // Execute multiple commands rapidly
    const commands = [
      'echo "test1"',
      'echo "test2"',
      'echo "test3"',
      'pwd',
      'whoami',
      'date',
      'echo "final"',
    ]

    for (const cmd of commands) {
      await terminal.fill(cmd)
      await terminal.press('Enter')
      await page.waitForTimeout(TIMEOUTS.SHORT_WAIT) // Small delay between commands
    }

    // Verify all commands executed
    await expect(page.locator('text=test1')).toBeVisible()
    await expect(page.locator('text=test2')).toBeVisible()
    await expect(page.locator('text=test3')).toBeVisible()
    await expect(page.locator(`text=/home/${USERNAME}/`).first()).toBeVisible()
    await expect(page.locator(`text=${USERNAME}`).first()).toBeVisible()
    await expect(page.locator('text=final')).toBeVisible()
  })

  test('should handle terminal resize', async ({ page }) => {
    await establishConnection(page)
    // Wait for the prompt in the actual terminal content, not the measure element
    await page.waitForFunction(
      () => {
        const terminalContent = document.querySelector('.xterm-rows')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    // Resize the viewport (which should trigger terminal resize)
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Execute a command to verify terminal still works after resize
    const terminal = page.getByRole(TERMINAL.INPUT_SELECTOR, { name: TERMINAL.INPUT_NAME })
    await terminal.fill('echo "Resize test passed"')
    await terminal.press('Enter')

    await expect(page.locator('text=Resize test passed')).toBeVisible()

    // Resize again
    await page.setViewportSize({ width: 800, height: 600 })
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Verify terminal still functional
    await terminal.fill('echo "Second resize OK"')
    await terminal.press('Enter')
    await expect(page.locator('text=Second resize OK')).toBeVisible()
  })

  test('should measure connection establishment time', async ({ page }) => {
    await page.goto(`${BASE_URL}/ssh`)

    // Measure time to establish connection
    const startTime = Date.now()

    await page.fill('[name="host"]', SSH_HOST)
    await page.fill('[name="port"]', String(SSH_PORT))
    await page.fill('[name="username"]', USERNAME)
    await page.fill('[name="password"]', PASSWORD)
    await page.click('button:has-text("Connect")')

    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })

    const connectionTime = Date.now() - startTime
    console.log(`Connection established in ${connectionTime}ms`)

    // Connection should be established within 5 seconds
    expect(connectionTime).toBeLessThan(TIMEOUTS.CONNECTION)
  })

  test('should handle special characters in commands', async ({ page }) => {
    await establishConnection(page)
    // Wait for the prompt in the actual terminal content, not the measure element
    await page.waitForFunction(
      () => {
        const terminalContent = document.querySelector('.xterm-rows')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    const terminal = page.getByRole(TERMINAL.INPUT_SELECTOR, { name: TERMINAL.INPUT_NAME })

    // Test various special characters
    const specialCommands = [
      'echo "Hello World!"',
      'echo "Test & Test"',
      'echo "Line1\\nLine2"',
      'echo "$HOME"',
      'echo "Tab\\tSeparated"',
      `echo "Quote's test"`,
      'echo "Backtick \\`test\\`"',
    ]

    for (const cmd of specialCommands) {
      await terminal.fill(cmd)
      await terminal.press('Enter')
      await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
    }

    // Verify output contains expected text
    await expect(page.locator('text=Hello World!')).toBeVisible()
    await expect(page.locator(`text=/home/${USERNAME}/`).first()).toBeVisible() // $HOME expansion
  })

  test('should maintain stable connection over time', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST_EXTENDED) // Increase timeout for this test

    await establishConnection(page)
    // Wait for the prompt in the actual terminal content, not the measure element
    await page.waitForFunction(
      () => {
        const terminalContent = document.querySelector('.xterm-rows')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    const terminal = page.getByRole(TERMINAL.INPUT_SELECTOR, { name: TERMINAL.INPUT_NAME })

    // Send periodic commands to verify connection stability
    for (let i = 0; i < 5; i++) {
      await terminal.fill(`echo "Ping ${i + 1}"`)
      await terminal.press('Enter')
      await expect(page.locator(`text=Ping ${i + 1}`)).toBeVisible()

      // Wait 5 seconds between pings
      await page.waitForTimeout(TIMEOUTS.LONG_WAIT)
    }

    // Verify connection is still active
    await terminal.fill('echo "Connection stable"')
    await terminal.press('Enter')
    await expect(page.locator('text=Connection stable')).toBeVisible()
  })
})
