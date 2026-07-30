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
 *   4. Asserts no app-originated CSP violations occurred. The one expected
 *      violation — the blocked legacy `window.webssh2Config = null;` inline
 *      script — is counted structurally: exactly one blocked-inline-script
 *      violation is required; any other violation kind fails the spec.
 *   5. (Strong) Evaluates in-page that the JSON config block is populated with
 *      a non-null object, confirming the JSON-block injection path works.
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

      // Assert no app-breaking CSP violations.
      // The one benign/expected violation is the blocked legacy inline
      // `window.webssh2Config = ...` script. Chromium's violation message
      // never includes script source (only a per-content sha256), so the
      // legacy script can't be matched by name: instead allow at most ONE
      // blocked-inline-script violation and require zero of any other kind.
      const inlineScriptViolations = cspMessages.filter((m) =>
        /Executing inline script/i.test(m)
      )
      const otherViolations = cspMessages.filter(
        (m) => !/Executing inline script/i.test(m)
      )
      expect(otherViolations).toEqual([])
      // Exactly one: the blocked legacy inline script is a free positive proof
      // that CSP enforcement is actually on — zero would mean enforcement
      // silently broke and this spec was passing vacuously. If the legacy
      // inline script is ever removed server-side, update this deliberately.
      expect(inlineScriptViolations).toHaveLength(1)

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
    }
  )
})
