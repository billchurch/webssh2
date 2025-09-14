// Contract test: verify expected HTTP routes are registered without invoking handlers
import test from 'node:test'
import assert from 'node:assert'
import { createRoutes } from '../../dist/app/routes.js'

const minimalConfig = {
  ssh: { host: 'example.com', port: 22, term: 'xterm-256color' },
  http: { origins: ['*:*'] },
  user: { name: null, password: null },
  session: { secret: 'x', name: 'y' },
  sso: { enabled: false, csrfProtection: false, trustedProxies: [], headerMapping: {} },
  options: { challengeButton: true, autoLog: false, allowReplay: true, allowReconnect: true, allowReauth: true },
}

function getRouteMap(router: any) {
  const layers = router.stack || []
  const byPath: Record<string, Set<string>> = {}
  for (const l of layers) {
    if (!l.route) continue
    const p = l.route.path
    const methods = Object.keys(l.route.methods)
    byPath[p] = byPath[p] || new Set()
    for (const m of methods) byPath[p].add(m)
  }
  return Object.fromEntries(Object.entries(byPath).map(([p, s]) => [p, Array.from(s).sort()]))
}

test('router registers expected paths and methods', () => {
  const router = createRoutes(minimalConfig)
  const byPath = getRouteMap(router)

  assert.ok(byPath['/'], 'GET / present')
  assert.ok(byPath['/'].includes('get'))

  assert.ok(byPath['/host/'], 'GET /host/ present')
  assert.ok(byPath['/host/'].includes('get'))

  assert.ok(byPath['/host/:host'], 'GET /host/:host present')
  assert.ok(byPath['/host/:host'].includes('get'))

  // POST endpoints
  assert.ok(byPath['/'], 'POST / present')
  assert.ok(byPath['/'].includes('post'))

  // Utility endpoints
  assert.ok(byPath['/clear-credentials'], 'GET /clear-credentials present')
  assert.ok(byPath['/clear-credentials'].includes('get'))

  assert.ok(byPath['/force-reconnect'], 'GET /force-reconnect present')
  assert.ok(byPath['/force-reconnect'].includes('get'))
})