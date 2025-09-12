import { test, expect } from '@playwright/test'
import { spawnSync, spawn } from 'node:child_process'
import net from 'node:net'

function dockerAvailable(): boolean {
  const res = spawnSync('docker', ['version'], { stdio: 'ignore' })
  return res.status === 0
}

async function waitForPort(host: string, port: number, timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise<void>((resolve) => {
      const socket = net.createConnection({ host, port })
      socket.once('connect', () => {
        socket.end()
        resolve()
      })
      socket.once('error', () => {
        setTimeout(resolve, 250)
      })
    })
    // simple check by attempting connect once per loop iteration
    try {
      await new Promise<void>((resolve, reject) => {
        const s = net.createConnection({ host, port }, () => {
          s.end(); resolve()
        })
        s.once('error', reject)
      })
      return
    } catch {
      // try again
    }
  }
  throw new Error(`Timeout waiting for ${host}:${port}`)
}

const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'
const DOCKER_OK = dockerAvailable()

test.describe('E2E: AcceptEnv via containerized SSHD', () => {
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run this test')
  test.skip(!DOCKER_OK, 'Docker is required for this test')

  const containerName = 'webssh2-e2e-sshd'

  test.beforeAll(async () => {
    // Start SSH test server container
    const runArgs = [
      'run', '--rm', '-d', '--name', containerName,
      '-p', '2244:22',
      '-e', 'SSH_USER=testuser',
      '-e', 'SSH_PASSWORD=testpassword',
      '-e', 'SSH_DEBUG_LEVEL=3',
      '-e', 'SSH_PERMIT_PASSWORD_AUTH=yes',
      '-e', 'SSH_PERMIT_PUBKEY_AUTH=yes',
      '-e', 'SSH_CUSTOM_CONFIG=PermitUserEnvironment yes\nAcceptEnv FOO',
      'ghcr.io/billchurch/ssh_test:alpine'
    ]
    const started = spawnSync('docker', runArgs, { stdio: 'inherit' })
    if (started.status !== 0) {
      throw new Error('Failed to start SSH test container')
    }
    await waitForPort('127.0.0.1', 2244, 20_000)
  })

  test.afterAll(() => {
    spawnSync('docker', ['stop', containerName], { stdio: 'inherit' })
  })

  test('forwards FOO=bar to SSH session', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      httpCredentials: { username: 'testuser', password: 'testpassword' },
    })
    const page = await context.newPage()

    await page.goto(`${baseURL}/ssh/host/localhost?port=2244&env=FOO:bar`)

    // Focus terminal and query the env var
    await page.locator('.xterm-helper-textarea').click()
    await page.keyboard.type('printenv FOO')
    await page.keyboard.press('Enter')

    // Wait for terminal to render the value
    await page.waitForTimeout(800)
    const content = await page.evaluate(() =>
      document.querySelector('.xterm-screen')?.textContent || ''
    )
    expect(content).toContain('bar')

    await context.close()
  })
})

