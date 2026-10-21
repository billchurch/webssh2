/* global document */
/**
 * CSP enforcement E2E spec — issue #546
 *
 * Validates that the WebSSH2 client works correctly under an ENFORCED
 * Content-Security-Policy.  The suite:
 *   1. Listens for console messages containing "Content Security Policy" so
 *      any runtime CSP violations from app code are captured.
 *   2. Navigates to a live SSH session using the same Basic Auth URL pattern
 *      as the other E2E SSH specs.
 *   3. Asserts the xterm terminal renders — proving the client read runtime
 *      config from the inert JSON block rather than the blocked inline script.
 *   4. Asserts zero CSP violations on a normal page load: the client ships no
 *      executable inline script (#588).
 *   5. (Strong) Evaluates in-page that the JSON config block is populated with
 *      a non-null object, confirming the JSON-block injection path works.
 *   6. Injects an inline script probe and asserts it is blocked, proving the
 *      policy is actually enforced (so step 4 cannot pass vacuously).
 *
 * Run requirements: ENABLE_E2E_SSH=1 plus the Docker/container SSH test server.
 * Without those, the spec is skipped (same guard as the other E2E SSH specs).
 *
 * The webServer in playwright.config.ts sets WEBSSH2_CSP_MODE=enforce by
 * default (overridable via E2E_CSP_MODE), so the entire E2E suite executes
 * under the enforced CSP when ENABLE_E2E_SSH=1 is set.
 */
import { test, expect } from '@playwright/test'
import {
  SSH_HOST,
  SSH_PORT,
  USERNAME,
  PASSWORD,
  BASE_URL,
  TIMEOUTS,
} from './constants.js'
import {
  buildBasicAuthUrl,
  waitForV2Connection,
  waitForV2Terminal,
} from './v2-helpers.js'

const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'

test.describe('CSP enforcement — terminal boots from JSON config block (#546)', () => {
  // Reason: requires a live Docker SSH test server; opt-in only via ENABLE_E2E_SSH=1.
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run this test')

  test(
    'terminal renders and no app CSP violations fire under enforced CSP',
    async ({ page }) => {
      // Collect console messages that mention the CSP BEFORE navigation so
      // we never miss an early violation.
      const cspMessages: string[] = []
      page.on('console', (msg) => {
        if (/Content Security Policy/i.test(msg.text())) {
          cspMessages.push(msg.text())
        }
      })

      // Navigate using Basic Auth URL — same pattern as the other E2E SSH specs.
      const url = buildBasicAuthUrl(BASE_URL, USERNAME, PASSWORD, SSH_HOST, SSH_PORT)
      await page.goto(url)

      // Wait for the WebSocket SSH connection to be established.
      await waitForV2Connection(page)

      // Wait for the xterm terminal to be visible and interactive.
      // This assertion implicitly proves that the client correctly read runtime
      // config from the inert JSON block: if the blocked inline script were the
      // only config source, the app would fail to initialize and the terminal
      // would never appear.
      await waitForV2Terminal(page, TIMEOUTS.CONNECTION)

      // The terminal canvas must be present in the DOM.
      await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })

      // A normal page load must produce no CSP violations at all.
      expect(cspMessages).toEqual([])

      // Strong assertion: evaluate in-page that the JSON config block exists
      // and contains a non-null parsed object.  This is the authoritative proof
      // that the server-side injection into the inert <script type="application/json">
      // element worked and the client consumed it.
      const blockOk = await page.evaluate(() => {
        const el = document.getElementById('webssh2-config')
        if (el === null) {
          return false
        }
        try {
          const parsed: unknown = JSON.parse(el.textContent)
          return typeof parsed === 'object' && parsed !== null
        } catch {
          return false
        }
      })
      expect(blockOk).toBe(true)

      // Positive proof that CSP is enforced: an inline script added to the
      // page must be blocked (it never runs) and report exactly one violation.
      // page.evaluate itself runs over the DevTools protocol and is not
      // subject to the page's CSP; the <script> element it adds is.
      const probeRan = await page.evaluate(() => {
        const probe = document.createElement('script')
        probe.textContent = 'document.documentElement.dataset.cspProbe = "ran"'
        document.body.append(probe)
        return document.documentElement.dataset.cspProbe === 'ran'
      })
      expect(probeRan).toBe(false)
      await expect
        .poll(() => cspMessages.filter((m) => /Executing inline script/i.test(m)).length)
        .toBe(1)
      expect(cspMessages).toHaveLength(1)
    }
  )
})
