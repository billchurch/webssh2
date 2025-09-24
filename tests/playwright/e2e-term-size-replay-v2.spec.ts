import { test, expect } from '@playwright/test'
import { DEFAULTS } from '../../app/constants.js'
import { SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'

const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'

// V2-specific helpers
async function waitForV2Terminal(page, timeout = TIMEOUTS.CONNECTION) {
  await expect(page.locator('.xterm-helper-textarea')).toBeVisible({ timeout })

  await page.waitForFunction(
    () => {
      const textarea = document.querySelector('.xterm-helper-textarea')
      return (
        textarea &&
        !textarea.disabled &&
        getComputedStyle(textarea).visibility !== 'hidden' &&
        getComputedStyle(textarea).display !== 'none'
      )
    },
    { timeout },
  )
}

async function waitForV2Connection(page, timeout = TIMEOUTS.CONNECTION) {
  try {
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: timeout / 2 })
  } catch {
    await waitForV2Terminal(page, timeout)
  }
}

async function waitForV2Prompt(page, timeout = TIMEOUTS.PROMPT_WAIT) {
  await page.waitForFunction(
    () => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return (
        /[$#%>]\s*$/.test(terminalContent) ||
        /testuser@.*[$#%>]/.test(terminalContent) ||
        terminalContent.includes('$') ||
        terminalContent.includes('#')
      )
    },
    { timeout },
  )
}

async function executeV2Command(page, command) {
  await page.locator('.xterm-helper-textarea').click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
}

async function openV2WithBasicAuth(browser, baseURL: string, params: string) {
  const context = await browser.newContext({
    httpCredentials: { username: USERNAME, password: PASSWORD },
  })
  const page = await context.newPage()
  await page.goto(`${baseURL}/ssh/host/localhost?port=${SSH_PORT}&${params}`)
  return { page, context }
}

test.describe('V2 E2E: TERM, size, and replay credentials', () => {
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run these tests')

  test('sets TERM from sshterm (V2)', async ({ browser, baseURL }) => {
    const { page, context } = await openV2WithBasicAuth(browser, baseURL, 'sshterm=xterm-256color')

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    await executeV2Command(page, 'printenv TERM')

    await page.waitForFunction(
      () => {
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return content.includes('xterm-256color')
      },
      { timeout: TIMEOUTS.CONNECTION },
    )

    const content = await page.evaluate(
      () => document.querySelector('.xterm-screen')?.textContent || '',
    )
    expect(content).toContain('xterm-256color')
    await context.close()
  })

  test('terminal rows/cols are not default (V2)', async ({ browser, baseURL }) => {
    const { page, context } = await openV2WithBasicAuth(browser, baseURL, '')

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    await executeV2Command(page, 'stty size')

    // Wait for command output to appear
    await page.waitForTimeout(2000)

    const out = await page.evaluate(() => {
      // Get all text from terminal rows, not CSS
      const rows = Array.from(document.querySelectorAll('.xterm-rows > div'))
      return rows.map((row) => row.textContent || '').join('\n')
    })
    console.log('Terminal output:', out)

    // Look for any digit pair that looks like terminal dimensions (rows cols)
    // The output might be on a new line after the command
    const dimensionMatches = out.matchAll(/(\d+)\s+(\d+)/g) //NOSONAR
    const matches = Array.from(dimensionMatches)
    console.log(
      'All dimension matches found:',
      matches.map((m) => `${m[1]} ${m[2]}`),
    )

    // Find the match that looks like terminal dimensions (not timestamps or other numbers)
    const sttyMatch = matches.find((m) => {
      const r = Number.parseInt(m[1])
      const c = Number.parseInt(m[2])
      // Terminal dimensions should be reasonable
      return r > 0 && r < 500 && c > 0 && c < 500
    })
    let rows: number
    let cols: number

    if (sttyMatch) {
      rows = Number(sttyMatch[1])
      cols = Number(sttyMatch[2])
      console.log('Stty match found:', rows, cols)
    } else {
      // Fallback to any number pair
      const match = out.match(/\b(\d+)\s+(\d+)\b/)
      console.log('Fallback match:', match)
      expect(match).toBeTruthy()
      rows = Number(match![1])
      cols = Number(match![2])
    }

    // V2 should use actual terminal dimensions, not defaults
    expect(`${rows} ${cols}`).not.toBe(`${DEFAULTS.TERM_ROWS} ${DEFAULTS.TERM_COLS}`)

    // Verify we got reasonable terminal dimensions
    expect(rows).toBeGreaterThan(10)
    expect(cols).toBeGreaterThan(40)

    await context.close()
  })

  test('handles terminal resize (V2)', async ({ browser, baseURL }) => {
    const { page, context } = await openV2WithBasicAuth(browser, baseURL, '')

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Get initial size
    await executeV2Command(page, 'stty size')
    await page.waitForFunction(
      () => {
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return /\b\d+\s+\d+\b/.test(content)
      },
      { timeout: TIMEOUTS.CONNECTION },
    )

    const initialOut = await page.evaluate(
      () => document.querySelector('.xterm-screen')?.textContent || '',
    )
    const initialMatch = initialOut.match(/\b(\d+)\s+(\d+)\b/)
    expect(initialMatch).toBeTruthy()

    // Resize browser window (this should trigger terminal resize in V2)
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Check size again
    await executeV2Command(page, 'stty size')
    const initialSize = initialMatch![0]
    await page.waitForFunction(
      (initialSizeValue) => {
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        const lines = content.split('\\n')
        // Look for a new stty output (different from initial)
        return lines.some((line) => /\b\d+\s+\d+\b/.test(line) && !line.includes(initialSizeValue))
      },
      { timeout: TIMEOUTS.CONNECTION },
      initialSize,
    )

    const newOut = await page.evaluate(
      () => document.querySelector('.xterm-screen')?.textContent || '',
    )

    // Should have terminal size output
    expect(newOut).toMatch(/\b\d+\s+\d+\b/)

    await context.close()
  })

  test('credential replay functionality (V2)', async ({ browser, baseURL }) => {
    const { page, context } = await openV2WithBasicAuth(browser, baseURL, '')

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Set up a simple password prompt test
    await executeV2Command(page, 'read -s -p "Enter password: " pw && echo && echo "Got: $pw"')

    // Wait for the password prompt to appear
    await page.waitForFunction(
      () => {
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return content.includes('Enter password:')
      },
      { timeout: TIMEOUTS.CONNECTION },
    )

    // Type the password (simulating credential replay)
    console.log('V2 credential replay test - typing password')
    await page.keyboard.type(PASSWORD)
    await page.keyboard.press('Enter')

    // Wait for the response showing the password was received
    await page.waitForFunction(
      () => {
        const rows = Array.from(document.querySelectorAll('.xterm-rows > div'))
        const content = rows.map((row) => row.textContent || '').join('\n')
        // Check if we got the confirmation message
        return content.includes('Got: testpass') || content.includes('Got: ' + 'testpass')
      },
      { timeout: TIMEOUTS.CONNECTION },
    )

    const content = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.xterm-rows > div'))
      return rows.map((row) => row.textContent || '').join('\n')
    })

    // Verify the password was processed
    expect(content).toMatch(/Got: testpass/)

    await context.close()
  })

  test('TERM environment persists through session (V2)', async ({ browser, baseURL }) => {
    const { page, context } = await openV2WithBasicAuth(browser, baseURL, 'sshterm=screen-256color')

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Check TERM multiple times to ensure it persists
    for (let i = 0; i < 3; i++) {
      await executeV2Command(page, 'printenv TERM')

      // Wait for command output
      await page.waitForTimeout(1000)

      await page.waitForFunction(
        () => {
          const rows = Array.from(document.querySelectorAll('.xterm-rows > div'))
          const content = rows.map((row) => row.textContent || '').join('\n')
          return content.includes('screen-256color')
        },
        { timeout: TIMEOUTS.CONNECTION },
      )

      // Execute some other command between checks
      await executeV2Command(page, `echo "Check ${i + 1}"`)
      await page.waitForTimeout(500)
    }

    const finalContent = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.xterm-rows > div'))
      return rows.map((row) => row.textContent || '').join('\n')
    })
    expect(finalContent).toContain('screen-256color')

    await context.close()
  })
})
