// Contract test: verify expected HTTP routes are registered without invoking handlers
import test from 'node:test'
import assert from 'node:assert'
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

void test('router registers expected paths and methods', () => {
  const router = createRoutes(minimalConfig)
  const byPath = getRouteMap(router)

  // Helper function to safely access byPath entries
  const hasPath = (path: string): path is keyof typeof byPath => {
    // eslint-disable-next-line security/detect-object-injection
    return path in byPath && byPath[path] !== undefined
  }

  assert.ok(hasPath('/'), 'GET / present')
  assert.ok(byPath['/']!.includes('get'))

  assert.ok(hasPath('/host/'), 'GET /host/ present')
  assert.ok(byPath['/host/']!.includes('get'))

  assert.ok(hasPath('/host/:host'), 'GET /host/:host present')
  assert.ok(byPath['/host/:host']!.includes('get'))

  // POST endpoints
  assert.ok(hasPath('/'), 'POST / present')
  assert.ok(byPath['/']!.includes('post'))

  // Utility endpoints
  assert.ok(hasPath('/clear-credentials'), 'GET /clear-credentials present')
  assert.ok(byPath['/clear-credentials']!.includes('get'))

  assert.ok(hasPath('/force-reconnect'), 'GET /force-reconnect present')
  assert.ok(byPath['/force-reconnect']!.includes('get'))
})