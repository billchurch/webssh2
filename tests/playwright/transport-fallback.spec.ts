/**
 * E2E proof of operator-forced Socket.IO transport fallback (#549 / #131).
 *
 * The shared Playwright webServer (see playwright.config.ts) starts a single
 * gateway with fixed env for the whole run, but this spec needs a different
 * WEBSSH2_OPTIONS_TRANSPORT per scenario. So each test spins up its own
 * short-lived gateway (`node dist/index.js`) on a dedicated port and tears
 * it down afterward, following the spawn/teardown shape used by
 * scripts/start-server.ts.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { test, expect, type Page } from '@playwright/test'
import { TEST_CONFIG } from './constants.js'
import { connectWithBasicAuth } from './v2-helpers.js'
import { TEST_SESSION_SECRET_VALID } from '../test-constants.js'

const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'

const GATEWAY_STARTUP_TIMEOUT = 15_000
const TRANSPORT_UPGRADE_TIMEOUT = 15_000

// Dedicated ports for this spec's private gateways. Distinct from the shared
// webServer port (4444 by default) and the E2E SSH container port, so runs
// never collide with the rest of the suite.
const POLLING_ONLY_PORT = 4301
const POLLING_UPGRADE_PORT = 4302
const DEFAULT_TRANSPORT_PORT = 4303

interface Gateway {
  readonly proc: ChildProcess
  readonly baseUrl: string
}

async function startGateway(port: number, env: Record<string, string>): Promise<Gateway> {
  // Strip any ambient WEBSSH2_OPTIONS_TRANSPORT before applying per-scenario
  // overrides, so a scenario that omits it (testing the "unset" default) is
  // hermetic regardless of what the enclosing shell/CI happens to export.
  const baseEnv = { ...process.env }
  delete baseEnv.WEBSSH2_OPTIONS_TRANSPORT

  const proc = spawn(process.execPath, ['dist/index.js'], {
    stdio: 'pipe',
    env: {
      ...baseEnv,
      WEBSSH2_LISTEN_PORT: String(port),
      WEBSSH2_SESSION_SECRET: TEST_SESSION_SECRET_VALID,
      ...env,
    },
  })

  let stderrOutput = ''
  proc.stderr.on('data', (chunk: Buffer) => {
    stderrOutput += chunk.toString()
  })

  const baseUrl = `http://localhost:${port}`
  try {
    await expect
      .poll(
        async () => {
          try {
            const res = await fetch(`${baseUrl}/ssh`)
            return res.status
          } catch {
            return 0
          }
        },
        { timeout: GATEWAY_STARTUP_TIMEOUT }
      )
      .toBeGreaterThan(0)
  } catch (error) {
    proc.kill()
    throw new Error(`Gateway on port ${port} failed to start: ${stderrOutput}`, { cause: error })
  }
  return { proc, baseUrl }
}

function stopGateway(gateway: Gateway): void {
  gateway.proc.kill()
}

// Socket.IO traffic for this gateway, observed from outside the page so the
// spec doesn't rely on any client-exposed global.
const SOCKET_IO_PATH = '/ssh/socket.io'
// engine.io UPGRADE packet: the client sends it on the probe WebSocket once
// the probe succeeds, and from then on that WebSocket carries the session.
const ENGINE_IO_UPGRADE_PACKET = '5'

interface ObservedWebSocket {
  readonly url: URL
  upgraded: boolean
  closed: boolean
}

interface TransportObserver {
  readonly pollingRequests: string[]
  readonly websockets: ObservedWebSocket[]
}

function observeTransport(page: Page): TransportObserver {
  const observer: TransportObserver = { pollingRequests: [], websockets: [] }

  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith(SOCKET_IO_PATH) && url.searchParams.get('transport') === 'polling') {
      observer.pollingRequests.push(request.url())
    }
  })

  page.on('websocket', (ws) => {
    const url = new URL(ws.url())
    if (!url.pathname.startsWith(SOCKET_IO_PATH)) {
      return
    }
    const observed: ObservedWebSocket = { url, upgraded: false, closed: false }
    observer.websockets.push(observed)
    ws.on('framesent', (frame) => {
      if (frame.payload === ENGINE_IO_UPGRADE_PACKET) {
        observed.upgraded = true
      }
    })
    ws.on('close', () => {
      observed.closed = true
    })
  })

  return observer
}

/**
 * The transport currently carrying the Socket.IO session, as seen on the wire.
 *
 * A WebSocket opened without a `sid` is a direct WebSocket session. One opened
 * with a `sid` is an upgrade probe from long-polling, and only becomes the
 * active transport once the client sends the UPGRADE packet on it.
 */
function activeTransport(observer: TransportObserver): 'websocket' | 'polling' | 'none' {
  const carryingSession = observer.websockets.some(
    (ws) => !ws.closed && (!ws.url.searchParams.has('sid') || ws.upgraded)
  )
  if (carryingSession) {
    return 'websocket'
  }
  return observer.pollingRequests.length > 0 ? 'polling' : 'none'
}

test.describe('operator-forced Socket.IO transport (#549/#131)', () => {
  // Reason: requires a live Docker SSH test server; opt-in only via ENABLE_E2E_SSH=1.
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run this test')

  test('transport=polling connects via long-polling and never upgrades', async ({ page }) => {
    const gateway = await startGateway(POLLING_ONLY_PORT, {
      WEBSSH2_OPTIONS_TRANSPORT: 'polling',
    })
    try {
      const observer = observeTransport(page)

      await connectWithBasicAuth(
        page,
        gateway.baseUrl,
        TEST_CONFIG.validUsername,
        TEST_CONFIG.validPassword,
        TEST_CONFIG.sshHost,
        TEST_CONFIG.sshPort
      )

      await expect.poll(() => activeTransport(observer)).toBe('polling')
      // With only 'polling' advertised server-side, engine.io's handshake
      // never lists 'websocket' as an available upgrade, so the client has
      // nothing to attempt — no timing race to guard against here.
      expect(observer.websockets).toHaveLength(0)
    } finally {
      stopGateway(gateway)
    }
  })

  test('transport=polling,websocket starts polling then upgrades', async ({ page }) => {
    const gateway = await startGateway(POLLING_UPGRADE_PORT, {
      WEBSSH2_OPTIONS_TRANSPORT: 'polling,websocket',
    })
    try {
      const observer = observeTransport(page)

      await connectWithBasicAuth(
        page,
        gateway.baseUrl,
        TEST_CONFIG.validUsername,
        TEST_CONFIG.validPassword,
        TEST_CONFIG.sshHost,
        TEST_CONFIG.sshPort
      )

      await expect
        .poll(() => activeTransport(observer), { timeout: TRANSPORT_UPGRADE_TIMEOUT })
        .toBe('websocket')
      // The session started on long-polling and moved over by upgrading the
      // probe WebSocket, not by opening a fresh one.
      expect(observer.pollingRequests.length).toBeGreaterThan(0)
      expect(observer.websockets.some((ws) => ws.upgraded)).toBe(true)
    } finally {
      stopGateway(gateway)
    }
  })

  test('no transport config keeps websocket-first default', async ({ page }) => {
    const gateway = await startGateway(DEFAULT_TRANSPORT_PORT, {})
    try {
      const observer = observeTransport(page)

      await connectWithBasicAuth(
        page,
        gateway.baseUrl,
        TEST_CONFIG.validUsername,
        TEST_CONFIG.validPassword,
        TEST_CONFIG.sshHost,
        TEST_CONFIG.sshPort
      )

      await expect.poll(() => activeTransport(observer)).toBe('websocket')
      // websocket-first: the session opens straight on a WebSocket and never
      // needs long-polling.
      expect(observer.pollingRequests).toHaveLength(0)
    } finally {
      stopGateway(gateway)
    }
  })
})
