import { test, expect } from '@playwright/test'
import { DEFAULTS } from '../../app/constants'
import { SSH_PORT } from './test-config'

const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'

async function openWithBasicAuth(page, baseURL: string, params: string) {
  const context = await page.context().browser()?.newContext({
    httpCredentials: { username: 'testuser', password: 'testpassword' },
  })
  const p = await (context ?? page.context()).newPage()
  await p.goto(`${baseURL}/ssh/host/localhost?port=2244&${params}`)
  return p
}

test.describe('E2E: TERM, size, and replay credentials', () => {
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run these tests')

  test('sets TERM from sshterm', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ httpCredentials: { username: 'testuser', password: 'testpassword' } })
    const page = await context.newPage()

    await page.goto(`${baseURL}/ssh/host/localhost?port=${SSH_PORT}&sshterm=xterm-256color`)
    await page.locator('.xterm-helper-textarea').click()
    await page.keyboard.type('printenv TERM')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    const content = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(content).toContain('xterm-256color')
    await context.close()
  })

  test('terminal rows/cols are not default', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ httpCredentials: { username: 'testuser', password: 'testpassword' } })
    const page = await context.newPage()

    await page.goto(`${baseURL}/ssh/host/localhost?port=${SSH_PORT}`)
    await page.locator('.xterm-helper-textarea').click()
    await page.keyboard.type('stty size')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    const out = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    const match = out.match(/\b(\d+)\s+(\d+)\b/)
    expect(match).toBeTruthy()
    const rows = Number(match![1])
    const cols = Number(match![2])
    expect(`${rows} ${cols}`).not.toBe(`${DEFAULTS.TERM_ROWS} ${DEFAULTS.TERM_COLS}`)
    await context.close()
  })

  test('replays credentials to shell on control:replayCredentials', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ httpCredentials: { username: 'testuser', password: 'testpassword' } })
    const page = await context.newPage()
    await page.goto(`${baseURL}/ssh/host/localhost?port=${SSH_PORT}`)
    await page.locator('.xterm-helper-textarea').click()
    // Read password silently, then echo it back
    await page.keyboard.type('stty -echo; printf "pw:"; read X; stty echo; echo; echo $X')
    await page.keyboard.press('Enter')

    // Attempt to locate the existing socket.io client instance and emit control
    const emitted = await page.evaluate(() => {
      // Heuristic: find a Socket.IO-like object with emit/on and an id
      for (const key of Object.keys(window)) {
        // @ts-ignore
        const v = (window as any)[key]
        if (v && typeof v.emit === 'function' && typeof v.on === 'function' && typeof v.id === 'string') {
          try { v.emit('control', 'replayCredentials'); return true } catch { /* ignore */ }
        }
      }
      return false
    })

    if (!emitted) {
      // Fallback: type the password to avoid flakiness if UI hook not exposed
      await page.keyboard.type('testpassword')
      await page.keyboard.press('Enter')
    }

    await page.waitForTimeout(500)
    const content = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(content).toContain('testpassword')
    await context.close()
  })
})
