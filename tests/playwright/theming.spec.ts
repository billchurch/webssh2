/* global window, localStorage */
/**
 * Terminal theming Playwright tests
 *
 * Test 1 - Smoke: connect via URL params → open Settings → select Dracula →
 *   Save → assert wrapper background → reload → assert persistence.
 *
 * Test 2 - Regression: pre-seed stale localStorage with Dracula entry while
 *   server theming is disabled → assert the wrapper bg does NOT show Dracula.
 */

import { test, expect } from '@playwright/test'
import {
  SSH_HOST,
  SSH_PORT,
  USERNAME,
  PASSWORD,
  TIMEOUTS,
} from './constants.js'
import { waitForV2Connection, waitForV2Terminal } from './v2-helpers.js'

const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'

// Dracula theme background as resolved by the browser
const DRACULA_BG = 'rgb(40, 42, 54)'

// Expected wrapper background when theming is disabled (no inline background
// style set, so the browser reports transparent).
const TRANSPARENT_BG = 'rgba(0, 0, 0, 0)'

test.describe('Terminal Theming', () => {
  // Reason: requires a live Docker SSH test server; opt-in only via ENABLE_E2E_SSH=1.
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run this test')

  test('smoke: select Dracula theme → persists across reload', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      httpCredentials: { username: USERNAME, password: PASSWORD },
    })
    const page = await context.newPage()

    // Navigate via URL params so the auto-connect flow fires immediately
    await page.goto(
      `${baseURL}/ssh/host/${SSH_HOST}?port=${SSH_PORT}`
    )

    // Wait for terminal to be connected and ready
    await waitForV2Connection(page)
    await waitForV2Terminal(page)

    // Give the terminal a moment to fully initialise before interacting with the menu
    await page.locator('.xterm-screen').waitFor({ state: 'visible' })

    // Open the Menu dropdown by hovering (the dropdown uses onMouseEnter to open)
    await page.locator('button', { hasText: 'Menu' }).hover()

    // Wait for the menu to appear and click Settings menu item
    const settingsItem = page.locator('button[role="menuitem"]', { hasText: 'Settings' })
    await settingsItem.waitFor({ state: 'visible' })
    await settingsItem.click()

    // The Terminal Theme section is gated on theming.enabled — expand it
    await page.locator('button', { hasText: 'Terminal Theme' }).click()

    // Select Dracula from the theme picker
    await page.locator('select[name="themeName"]').selectOption('Dracula')

    // Save the settings
    await page.locator('button[type="submit"]', { hasText: 'Save' }).click()

    // Assert the wrapper background colour matches Dracula
    const wrapper = page.locator('[data-testid="terminal-wrapper"]')
    await expect(wrapper).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
    const bgAfterSave = await wrapper.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    )
    expect(bgAfterSave).toBe(DRACULA_BG)

    // Reload and re-assert that the theme is persisted from localStorage
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await page.locator('.xterm-screen').waitFor({ state: 'visible' })

    await expect(wrapper).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
    const bgAfterReload = await wrapper.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    )
    expect(bgAfterReload).toBe(DRACULA_BG)

    await context.close()
  })

  test('theming disabled: stale localStorage falls back to Default', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      httpCredentials: { username: USERNAME, password: PASSWORD },
    })
    const page = await context.newPage()

    // Pre-seed stale localStorage with a Dracula theming entry
    await page.addInitScript(() => {
      localStorage.setItem(
        'webssh2.theming',
        JSON.stringify({ themeName: 'Dracula' })
      )
    })

    // Patch the served JSON config block (the source the client boots from
    // under enforced CSP, #546) so theming is disabled regardless of server
    // config. Route interception is NOT usable here: a route.fulfill()'d
    // document loses its local address-space attribution and Chromium's
    // Local Network Access checks then block the ws://localhost socket.
    // Instead, rewrite the inert block's text before the (deferred) module
    // script executes — init scripts run ahead of all page scripts.
    await page.addInitScript(() => {
      /* global document, MutationObserver */
      const observer = new MutationObserver(() => {
        const el = document.getElementById('webssh2-config')
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain, @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison
        if (el === null || el.textContent === null || el.textContent === '') {
          return
        }
        try {
          const cfg = JSON.parse(el.textContent) as Record<string, unknown>
          cfg['theming'] = { enabled: false }
          el.textContent = JSON.stringify(cfg)
          observer.disconnect()
        } catch {
          // JSON text still streaming in — keep observing until it parses
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      observer.observe(document.documentElement ?? document, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    })

    await page.goto(
      `${baseURL}/ssh/host/${SSH_HOST}?port=${SSH_PORT}`
    )

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await page.locator('.xterm-screen').waitFor({ state: 'visible' })

    // When theming is disabled, the wrapper div has no background-color style,
    // so the computed colour is transparent.
    const wrapper = page.locator('[data-testid="terminal-wrapper"]')
    await expect(wrapper).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
    const bg = await wrapper.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    )
    expect(bg).not.toBe(DRACULA_BG)
    // Confirm it is transparent (the default for an un-styled div)
    expect(bg).toBe(TRANSPARENT_BG)

    await context.close()
  })
})
