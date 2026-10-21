import { test, expect, type Page, type Request } from '@playwright/test'
import { TEST_CONFIG } from './constants.js'

// Reports whether the first request for `url` in one navigation carried an
// Authorization header, i.e. whether the browser replayed cached Basic
// credentials instead of waiting for a new challenge.
async function sendsCachedCredentials(page: Page, url: string): Promise<boolean> {
  const sent: Array<Promise<boolean>> = []
  const onRequest = (request: Request): void => {
    if (request.url() === url) {
      sent.push(request.allHeaders().then((headers) => headers['authorization'] !== undefined))
    }
  }
  page.on('request', onRequest)
  await page.goto(url)
  page.off('request', onRequest)
  expect(sent.length).toBeGreaterThan(0)
  return sent[0]
}

test.describe('GET /ssh/clear-credentials in the browser', () => {
  test.use({
    httpCredentials: {
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    }
  })

  test('makes the browser drop cached Basic credentials', async ({ page }) => {
    const hostUrl = `${TEST_CONFIG.baseUrl}/ssh/host/${TEST_CONFIG.sshHost}`
    const clearUrl = `${TEST_CONFIG.baseUrl}/ssh/clear-credentials`

    await page.goto(hostUrl)
    expect(await sendsCachedCredentials(page, hostUrl)).toBe(true)

    const cleared = await page.request.get(clearUrl)
    expect(cleared.status()).toBe(200)
    expect(cleared.headers()['clear-site-data']).toBe('"cookies"')
    expect(await cleared.json()).toEqual({ message: 'Credentials cleared.' })

    // Clear-Site-Data takes effect on a browser navigation, not on page.request
    await page.goto(clearUrl)

    expect(await sendsCachedCredentials(page, hostUrl)).toBe(false)
  })
})
