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

    // Wait for the menu to appear
    await page
      .locator('button[role="menuitem"]', { hasText: 'Settings' })
      .waitFor({ state: 'visible' })

    // Click Settings menu item
    await page
      .locator('button[role="menuitem"]', { hasText: 'Settings' })
      .click()

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

    // Override window.webssh2Config before the inline script runs so that the
    // client sees theming as disabled regardless of the server config.
    await page.addInitScript(() => {
      let _cfg: unknown = null
      Object.defineProperty(window, 'webssh2Config', {
        configurable: true,
        get() {
          return _cfg
        },
        set(v) {
          _cfg = {
            ...(v as Record<string, unknown>),
            theming: { enabled: false },
          }
        },
      })
    })

    // Pre-seed stale localStorage with a Dracula theming entry
    await page.addInitScript(() => {
      localStorage.setItem(
        'webssh2.theming',
        JSON.stringify({ themeName: 'Dracula' })
      )
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
