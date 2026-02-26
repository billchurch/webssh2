/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test'
import { DEFAULTS } from '../../app/constants/index.js'
import { SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'

const E2E_ENABLED = process.env['ENABLE_E2E_SSH'] === '1'

// V2-specific helpers
async function waitForV2Terminal(page: Page, timeout = TIMEOUTS.CONNECTION): Promise<void> {
  await expect(page.locator('.xterm-helper-textarea')).toBeVisible({ timeout })

  await page.waitForFunction(
    () => {
      const textarea = document.querySelector('.xterm-helper-textarea')
      return (
        textarea !== null &&
        !(textarea as HTMLInputElement).disabled &&
        getComputedStyle(textarea).visibility !== 'hidden' &&
        getComputedStyle(textarea).display !== 'none'
      )
    },
    { timeout },
  )
}

async function waitForV2Connection(page: Page, timeout = TIMEOUTS.CONNECTION): Promise<void> {
  try {
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: timeout / 2 })
  } catch {
    await waitForV2Terminal(page, timeout)
  }
}

async function waitForV2Prompt(page: Page, timeout = TIMEOUTS.PROMPT_WAIT): Promise<void> {
  await page.waitForFunction(
    () => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent ?? ''
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

async function executeV2Command(page: Page, command: string): Promise<void> {
  await page.locator('.xterm-helper-textarea').click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
}

async function openV2WithBasicAuth(browser: Browser, baseURL: string | undefined, params: string): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext({
    httpCredentials: { username: USERNAME, password: PASSWORD },
  })
  const page = await context.newPage()
  await page.goto(`${baseURL ?? ''}/ssh/host/localhost?port=${SSH_PORT}&${params}`)
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
        const content = document.querySelector('.xterm-screen')?.textContent ?? ''
        return content.includes('xterm-256color')
      },
      { timeout: TIMEOUTS.CONNECTION },
    )

    const content = await page.evaluate(
      () => document.querySelector('.xterm-screen')?.textContent ?? '',
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
      return rows.map((row) => row.textContent ?? '').join('\n')
    })

    // Look for any digit pair that looks like terminal dimensions (rows cols)
    // The output might be on a new line after the command
    const dimensionMatches = out.matchAll(/(\d+)\s+(\d+)/g) //NOSONAR
    const matches = Array.from(dimensionMatches)

    // Find the match that looks like terminal dimensions (not timestamps or other numbers)
    const sttyMatch = matches.find((m) => {
      const r = Number.parseInt(m[1] ?? '0')
      const c = Number.parseInt(m[2] ?? '0')
      // Terminal dimensions should be reasonable
      return r > 0 && r < 500 && c > 0 && c < 500
    })
    let rows: number
    let cols: number

    if (sttyMatch === undefined) {
      // Fallback to any number pair
      const match = /\b(\d+)\s+(\d+)\b/.exec(out)
      expect(match).toBeTruthy()
      if (match === null) {
        throw new Error(`Expected fallback dimensions in terminal output: ${out.slice(0, 500)}`)
      }
      rows = Number(match[1])
      cols = Number(match[2])
    } else {
      rows = Number(sttyMatch[1])
      cols = Number(sttyMatch[2])
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

    // Wait for output and check initial size
    await page.waitForTimeout(1000)

    // Try to get text content from the terminal rows instead
    const getTerminalText = async (): Promise<string> => {
      return page.evaluate(() => {
        // Try different selectors to find the actual text content
        const terminal = document.querySelector('.xterm')
        const rows = terminal?.querySelector('.xterm-rows') as HTMLElement | null
        const screen = terminal?.querySelector('.xterm-screen') as HTMLElement | null

        // First try innerText which should give visible text
        let text = rows?.innerText ?? screen?.innerText ?? ''

        // Fallback to textContent if innerText is empty
        if (text === '') {
          text = rows?.textContent ?? screen?.textContent ?? ''
        }

        return text
      })
    }

    const initialOut: string = await getTerminalText()

    // Extract size from output
    const sizeMatches: RegExpMatchArray[] = [...initialOut.matchAll(/\b(\d+)\s+(\d+)\b/g)]
    const initialSizeMatch: RegExpMatchArray | undefined = sizeMatches.at(-1)

    if (initialSizeMatch === undefined) {
      throw new Error(`No initial size found in terminal output: ${initialOut.slice(0, 500)}`)
    }

    const initialSize: string = initialSizeMatch[0]

    // Resize browser window (this should trigger terminal resize in V2)
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)

    // Check size again (don't clear to preserve history)
    await executeV2Command(page, 'stty size')

    // Wait for command output
    await page.waitForTimeout(1500)

    // Get the new content after resize
    const newOut: string = await getTerminalText()

    // Find all size patterns in the output
    const newSizeMatches: RegExpMatchArray[] = [...newOut.matchAll(/\b(\d+)\s+(\d+)\b/g)]

    // The last match should be our new size
    const lastSizeMatch: RegExpMatchArray | undefined = newSizeMatches.at(-1)

    if (lastSizeMatch === undefined) {
      throw new Error(`No size found after resize. Terminal output: ${newOut.slice(0, 500)}`)
    }

    const newSize: string = lastSizeMatch[0]

    // Verify it's different from initial
    expect(newSize).not.toBe(initialSize)

    // Verify we got reasonable values (not 0 0)
    expect(newSize).not.toBe('0 0')
    expect(initialSize).not.toBe('0 0')

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
        const content = document.querySelector('.xterm-screen')?.textContent ?? ''
        return content.includes('Enter password:')
      },
      { timeout: TIMEOUTS.CONNECTION },
    )

    // Type the password (simulating credential replay)
    await page.keyboard.type(PASSWORD)
    await page.keyboard.press('Enter')

    // Wait for the response showing the password was received
    await page.waitForFunction(
      (expectedPassword) => {
        const rows = Array.from(document.querySelectorAll('.xterm-rows > div'))
        const content = rows.map((row) => row.textContent || '').join('\n')
        // Check if we got the confirmation message
        return content !== '' && (content.includes('Got: testpass') || content.includes(`Got: ${expectedPassword}`))
      },
      PASSWORD,
      { timeout: TIMEOUTS.CONNECTION },
    )

    const content = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.xterm-rows > div'))
      return rows.map((row) => row.textContent ?? '').join('\n')
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
          return content !== '' && content.includes('screen-256color')
        },
        { timeout: TIMEOUTS.CONNECTION },
      )

      // Execute some other command between checks
      await executeV2Command(page, `echo "Check ${i + 1}"`)
      await page.waitForTimeout(500)
    }

    const finalContent = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.xterm-rows > div'))
      return rows.map((row) => row.textContent ?? '').join('\n')
    })
    expect(finalContent).toContain('screen-256color')

    await context.close()
  })
})
