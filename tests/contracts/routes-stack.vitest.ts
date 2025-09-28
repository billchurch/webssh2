// Contract test: verify expected HTTP routes are registered without invoking handlers
import { it, expect } from 'vitest'
import { createRoutesV2 as createRoutes } from '../../dist/app/routes/routes-v2.js'
import { TEST_SECRET } from '../test-constants.js'

const minimalConfig = {
  ssh: { host: 'example.com', port: 22, term: 'xterm-256color' },
  http: { origins: ['*:*'] },
  user: { name: null, password: null },
  session: { secret: TEST_SECRET, name: 'y' },
  sso: { enabled: false, csrfProtection: false, trustedProxies: [], headerMapping: {} },
  options: { challengeButton: true, autoLog: false, allowReplay: true, allowReconnect: true, allowReauth: true },
}

interface RouterLayer {
  route?: {
    path: string
    methods: Record<string, boolean>
  }
}

interface RouterLike {
  stack?: RouterLayer[]
}

function getRouteMap(router: unknown): Record<string, string[] | undefined> {
  const routerLike = router as RouterLike
  const layers = routerLike.stack ?? []
  const byPath: Record<string, Set<string>> = {}
  for (const l of layers) {
    if (l.route === undefined) { continue }
    const p = l.route.path
    const methods = Object.keys(l.route.methods)
    // eslint-disable-next-line security/detect-object-injection
    byPath[p] = byPath[p] ?? new Set()
    // eslint-disable-next-line security/detect-object-injection
    for (const m of methods) { byPath[p].add(m) }
  }
  return Object.fromEntries(Object.entries(byPath).map(([p, s]) => [p, Array.from(s).sort()]))
}

it('router registers expected paths and methods', () => {
  const router = createRoutes(minimalConfig)
  const byPath = getRouteMap(router)

  // Helper function to safely access byPath entries
  const hasPath = (path: string): path is keyof typeof byPath => {
    // eslint-disable-next-line security/detect-object-injection
    return path in byPath && byPath[path] !== undefined
  }

  // Helper to assert route exists with expected method
  const assertRoute = (path: string, method: string): void => {
    expect(hasPath(path)).toBeTruthy()
    // eslint-disable-next-line security/detect-object-injection
    expect(byPath[path]!.includes(method)).toBeTruthy()
  }

  assertRoute('/', 'get')
  assertRoute('/host/', 'get')
  assertRoute('/host/:host', 'get')

  // POST endpoints
  assertRoute('/', 'post')

  // Utility endpoints
  assertRoute('/clear-credentials', 'get')
  assertRoute('/force-reconnect', 'get')
})