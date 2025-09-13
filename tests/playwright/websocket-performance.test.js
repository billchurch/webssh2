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
        const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    // Generate and display large output
    await page.locator('.xterm-helper-textarea').click()

    // Test with a command that generates substantial output
    await page.keyboard.type('seq 1 1000')
    await page.keyboard.press('Enter')

    // Wait for command to complete and check that output was generated
    await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
    
    // Verify the terminal contains the expected output (last visible numbers)
    const terminalContent = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(terminalContent).toContain('1000') // Last number should be visible
    expect(terminalContent.length).toBeGreaterThan(1000) // Should have substantial output
  })

  test('should handle rapid command execution', async ({ page }) => {
    await establishConnection(page)
    // Wait for the prompt in the actual terminal content, not the measure element
    await page.waitForFunction(
      () => {
        const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    await page.locator('.xterm-helper-textarea').click()

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
      await page.keyboard.type(cmd)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(TIMEOUTS.SHORT_WAIT) // Small delay between commands
    }

    // Wait for all commands to complete
    await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
    
    // Verify all commands executed by checking terminal content
    const terminalContent = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(terminalContent).toContain('test1')
    expect(terminalContent).toContain('test2')
    expect(terminalContent).toContain('test3')
    expect(terminalContent).toContain(USERNAME)
    expect(terminalContent).toContain('final')
  })

  test('should handle terminal resize', async ({ page }) => {
    await establishConnection(page)
    // Wait for the prompt in the actual terminal content, not the measure element
    await page.waitForFunction(
      () => {
        const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    // Resize the viewport (which should trigger terminal resize)
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Execute a command to verify terminal still works after resize
    await page.locator('.xterm-helper-textarea').click()
    await page.keyboard.type('echo "Resize test passed"')
    await page.keyboard.press('Enter')

    // Wait for output and verify
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
    const content1 = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(content1).toContain('Resize test passed')

    // Resize again
    await page.setViewportSize({ width: 800, height: 600 })
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Verify terminal still functional
    await page.keyboard.type('echo "Second resize OK"')
    await page.keyboard.press('Enter')
    // Wait for output and verify
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
    const content2 = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(content2).toContain('Second resize OK')
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
        const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    await page.locator('.xterm-helper-textarea').click()

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
      await page.keyboard.type(cmd)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
    }

    // Wait for commands to complete and verify output
    await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
    const terminalContent = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(terminalContent).toContain('Hello World!')
    expect(terminalContent).toContain(`/home/${USERNAME}`) // $HOME expansion
  })

  test('should maintain stable connection over time', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST_EXTENDED) // Increase timeout for this test

    await establishConnection(page)
    // Wait for the prompt in the actual terminal content, not the measure element
    await page.waitForFunction(
      () => {
        const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
        return /[$#]\s*$/.test(terminalContent)
      },
      { timeout: TIMEOUTS.PROMPT_WAIT }
    )

    await page.locator('.xterm-helper-textarea').click()

    // Send periodic commands to verify connection stability
    for (let i = 0; i < 5; i++) {
      await page.keyboard.type(`echo "Ping ${i + 1}"`)
      await page.keyboard.press('Enter')
      
      // Wait for output and verify
      await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
      const content = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
      expect(content).toContain(`Ping ${i + 1}`)

      // Wait 5 seconds between pings
      await page.waitForTimeout(TIMEOUTS.LONG_WAIT)
    }

    // Verify connection is still active
    await page.keyboard.type('echo "Connection stable"')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
    const finalContent = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(finalContent).toContain('Connection stable')
  })
})
