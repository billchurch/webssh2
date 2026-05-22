/**
 * Smoke tests for issue #102 — removal of unsafe headerStyle / Tailwind-class
 * injection paths.
 *
 * Spec: webssh2_client/DOCS/superpowers/specs/2026-05-21-issue-102-headerstyle-removal-design.md
 *
 * These smokes verify the boundary between the server (drops `headerStyle` and
 * `header.color` from extraction, preserves prior overrides on legacy-only
 * requests via hasAnyHeaderKey) and the client (validates background via
 * `validateHeaderBackground`, renders default `#000` fallback on rejection).
 *
 * No SSH connection is required — the smokes assert on the rendered page's
 * `window.webssh2Config` object and the header `<div>`'s styling.
 */
/* global window, fetch */
import { test, expect, type Page } from '@playwright/test'
import { BASE_URL } from './constants.js'

const SSH_QUERY = 'host=localhost&port=22'

// The Playwright config template (tests/playwright/assets/config.template.json)
// sets header.background = "green" by default. When no URL override is applied,
// buildHeaderConfig returns { header: { background: 'green' } }. Tests assert
// against this default explicitly so a missing-override case isn't confused with
// a "no header at all" case.
const DEFAULT_HEADER: HeaderConfig = { background: 'green' }

// The header bar and the footer/status bar both use `z-[99] h-6`. They differ
// on border direction: header has border-b (below), footer has border-t (above).
const HEADER_BAR_SELECTOR = 'div.z-\\[99\\].border-b'

interface HeaderConfig {
  text?: string
  background?: string
}

interface WebSSH2Config {
  header?: HeaderConfig
  [key: string]: unknown
}

declare global {
  interface Window {
    webssh2Config?: WebSSH2Config
  }
}

async function getInjectedConfig(page: Page): Promise<WebSSH2Config | undefined> {
  return page.evaluate(() => window.webssh2Config)
}

function extractConfigFromHtml(html: string): WebSSH2Config {
  const match = html.match(/window\.webssh2Config = (\{.+?\});/s)
  if (match?.[1] === undefined) {
    throw new Error('window.webssh2Config not found in response HTML')
  }
  return JSON.parse(match[1]) as WebSSH2Config
}

test.describe('Issue #102 — headerStyle/Tailwind injection removal', () => {

  test('S1: headerStyle clickjacking payload produces no header override', async ({ page }) => {
    // The dormant clickjacking primitive: `fixed inset-0 z-50 bg-black bg-opacity-100 cursor-pointer`
    // as a Tailwind class string. Pre-#102 the client's substring heuristic flipped
    // styleIsTailwind=true and concatenated this string into the header div's class
    // attribute, producing a full-viewport overlay. Post-#102 the server doesn't
    // extract `headerStyle` at all (dropped from detectSourceType), so cfg.header
    // remains at the config-default `{ background: 'green' }`.
    await page.goto(
      `${BASE_URL}/ssh?${SSH_QUERY}` +
        `&headerStyle=${encodeURIComponent('fixed inset-0 z-50 bg-black bg-opacity-100 cursor-pointer')}`
    )

    const cfg = await getInjectedConfig(page)
    expect(cfg?.header, 'headerStyle must not influence cfg.header').toEqual(DEFAULT_HEADER)
  })

  test('S2: ?header + ?headerBackground=#ff00aa renders the bar', async ({ page }) => {
    await page.goto(
      `${BASE_URL}/ssh?${SSH_QUERY}&header=Production&headerBackground=${encodeURIComponent('#ff00aa')}`
    )

    const cfg = await getInjectedConfig(page)
    expect(cfg?.header).toMatchObject({ text: 'Production', background: '#ff00aa' })

    // The header bar is the `z-[99]` div with border-b (below the menu).
    const header = page.locator(HEADER_BAR_SELECTOR)
    await expect(header).toBeVisible()
    await expect(header).toContainText('Production')
    // CSS reports as rgb()
    await expect(header).toHaveCSS('background-color', 'rgb(255, 0, 170)')
  })

  test('S3: ?headerBackground=fixed inset-0... falls back to #000 at render', async ({ page }) => {
    // The server's validateHeaderValue only strips control chars — it does NOT
    // enforce the CSS color regex. So the Tailwind class string passes server-side
    // validation and gets emitted to the client. The client's
    // validateHeaderBackground (which has the space-rejection rule from Task 1.1)
    // rejects it and the renderer falls back to '#000'. No overlay primitive.
    await page.goto(
      `${BASE_URL}/ssh?${SSH_QUERY}&header=Test&headerBackground=${encodeURIComponent('fixed inset-0 z-50 bg-black')}`
    )

    const header = page.locator(HEADER_BAR_SELECTOR)
    await expect(header).toBeVisible()
    await expect(header).toContainText('Test')

    // #000 fallback — NOT the attack payload
    await expect(header).toHaveCSS('background-color', 'rgb(0, 0, 0)')

    // Critical: the div must not be position:fixed (the actual clickjacking vector)
    await expect(header).not.toHaveCSS('position', 'fixed')

    // And must not be the full viewport
    const box = await header.boundingBox()
    expect(box, 'header bounding box should exist').not.toBeNull()
    if (box !== null) {
      const viewport = page.viewportSize()
      if (viewport !== null) {
        expect(box.width, 'header should not cover viewport width').toBeLessThan(viewport.width + 1)
        // Bar has fixed h-6 (24px) — assert it's nowhere near full-viewport height
        expect(box.height, 'header should not cover viewport height').toBeLessThan(100)
      }
    }
  })

  test('S4: CSS exfil URL in headerStyle does not trigger any external fetch', async ({ page }) => {
    const exfilRequests: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      try {
        // Only flag requests whose HOSTNAME is evil.example.com — not page
        // loads whose query string mentions it in a parameter value.
        if (new URL(url).hostname === 'evil.example.com') {
          exfilRequests.push(url)
        }
      } catch {
        // ignore unparseable URLs
      }
    })

    await page.goto(
      `${BASE_URL}/ssh?${SSH_QUERY}&headerStyle=${encodeURIComponent("background: red url('//evil.example.com/x')")}`
    )

    // Give the page time for any async resource loads
    await page.waitForLoadState('networkidle')

    expect(exfilRequests, 'no requests to evil.example.com').toEqual([])
  })

  test('S5: legacy headerStyle alone produces no header override (silently ignored)', async ({ page }) => {
    await page.goto(`${BASE_URL}/ssh?${SSH_QUERY}&headerStyle=bg-red-500`)

    const cfg = await getInjectedConfig(page)
    expect(cfg?.header, 'headerStyle must not influence cfg.header').toEqual(DEFAULT_HEADER)
  })

  test('S6: legacy POST header.color preserves prior session override', async ({ page }) => {
    // Step 1: Set override via GET. window.webssh2Config gets baked with header.
    await page.goto(
      `${BASE_URL}/ssh?${SSH_QUERY}&header=KEEP&headerBackground=${encodeURIComponent('#ff00aa')}`
    )
    const initialCfg = await getInjectedConfig(page)
    expect(initialCfg?.header).toMatchObject({ text: 'KEEP', background: '#ff00aa' })

    // Step 2: Send a legacy-only POST with the same browser cookies. The body
    // carries `header.color` but no recognized current keys. Without the
    // hasAnyHeaderKey guard added in Task 2.6, processHeaderParameters would
    // hit the clear branch and wipe the session.headerOverride. With the
    // guard, the override is preserved.
    //
    // We assert by reading the POST response HTML — the rendered config
    // reflects what's in the session at the moment the response is produced.
    const responseHtml = await page.evaluate(async (baseUrl) => {
      const formData = new URLSearchParams({
        host: 'localhost',
        port: '22',
        username: 'testuser',
        password: 'testpassword',
        'header.color': 'blue',
      })
      const res = await fetch(`${baseUrl}/ssh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        // include cookies (same-origin is default but be explicit)
        credentials: 'include',
      })
      return res.text()
    }, BASE_URL)

    const postResponseCfg = extractConfigFromHtml(responseHtml)
    expect(
      postResponseCfg.header,
      'legacy-only POST must NOT clear the prior session.headerOverride'
    ).toMatchObject({ text: 'KEEP', background: '#ff00aa' })
  })

  test('S7: non-header POST still clears prior override (existing semantics preserved)', async ({ page }) => {
    // Regression guard: the hasAnyHeaderKey fix should not break the existing
    // behavior where a normal auth POST without header fields clears any prior
    // header override on the session.
    await page.goto(
      `${BASE_URL}/ssh?${SSH_QUERY}&header=STALE&headerBackground=${encodeURIComponent('#ff00aa')}`
    )
    const initialCfg = await getInjectedConfig(page)
    expect(initialCfg?.header).toMatchObject({ text: 'STALE' })

    const responseHtml = await page.evaluate(async (baseUrl) => {
      const formData = new URLSearchParams({
        host: 'localhost',
        port: '22',
        username: 'testuser',
        password: 'testpassword',
        // no header.* fields at all
      })
      const res = await fetch(`${baseUrl}/ssh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        credentials: 'include',
      })
      return res.text()
    }, BASE_URL)

    const postResponseCfg = extractConfigFromHtml(responseHtml)
    // After clearing the session override, the rendered cfg falls back to the
    // config default. It must NOT carry our 'STALE' text.
    expect(postResponseCfg.header).toEqual(DEFAULT_HEADER)
    expect(
      postResponseCfg.header?.text,
      'non-header POST must clear the prior text override'
    ).toBeUndefined()
  })
})
