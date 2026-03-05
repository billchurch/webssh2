import { describe, expect, it } from 'vitest'
import { createTelnetRoutes } from '../../../app/routes/telnet-routes.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { TELNET_DEFAULTS, HTTP } from '../../../app/constants/index.js'
import { TEST_SESSION_SECRET_VALID } from '@tests/test-constants.js'
import type { Config } from '../../../app/types/config.js'

type LayerRoute = {
  path: string
  methods: Record<string, boolean>
  stack: Array<{ handle: (req: unknown, res: unknown) => void }>
}

type RouterStack = { stack: Array<{ route?: LayerRoute }> }

/**
 * Create a test config with telnet enabled
 */
function createTelnetEnabledConfig(): Config {
  const secret: string = TEST_SESSION_SECRET_VALID
  const config = createDefaultConfig(secret)
  config.telnet = {
    enabled: true,
    defaultPort: TELNET_DEFAULTS.PORT,
    timeout: TELNET_DEFAULTS.TIMEOUT_MS,
    term: TELNET_DEFAULTS.TERM,
    auth: {
      loginPrompt: TELNET_DEFAULTS.LOGIN_PROMPT,
      passwordPrompt: TELNET_DEFAULTS.PASSWORD_PROMPT,
      failurePattern: TELNET_DEFAULTS.FAILURE_PATTERN,
      expectTimeout: TELNET_DEFAULTS.EXPECT_TIMEOUT_MS,
    },
    allowedSubnets: [],
  }
  return config
}

function extractRoutes(router: unknown): Array<{ path: string; methods: string[] }> {
  const stack = (router as RouterStack).stack
  const routes: Array<{ path: string; methods: string[] }> = []
  for (const layer of stack) {
    if (layer.route !== undefined) {
      routes.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      })
    }
  }
  return routes
}

function findConfigHandler(router: unknown): LayerRoute['stack'][0] | undefined {
  const stack = (router as RouterStack).stack
  for (const layer of stack) {
    const route = layer.route
    if (route?.path === '/config' && route.methods['get'] === true) {
      return route.stack[0]
    }
  }
  return undefined
}

function createMockResponse(): {
  statusCode: number
  headers: Record<string, string>
  body: Record<string, unknown>
  setHeader: (key: string, value: string) => unknown
  status: (code: number) => unknown
  json: (data: Record<string, unknown>) => unknown
} {
  const state = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: {} as Record<string, unknown>,
  }
  return {
    get statusCode() { return state.statusCode },
    get headers() { return state.headers },
    get body() { return state.body },
    setHeader(key: string, value: string) {
      state.headers[key] = value
      return this
    },
    status(code: number) {
      state.statusCode = code
      return this
    },
    json(data: Record<string, unknown>) {
      state.body = data
      return this
    },
  }
}

describe('createTelnetRoutes', () => {
  it('returns a valid Express router', () => {
    const config = createTelnetEnabledConfig()
    const router = createTelnetRoutes(config)
    expect(router).toBeDefined()
    // Express Router is a function
    expect(typeof router).toBe('function')
  })

  it('registers expected route paths', () => {
    const config = createTelnetEnabledConfig()
    const router = createTelnetRoutes(config)
    const routePaths = extractRoutes(router)

    // Verify GET / exists
    expect(routePaths).toContainEqual(
      expect.objectContaining({ path: '/', methods: expect.arrayContaining(['get']) })
    )

    // Verify GET /config exists
    expect(routePaths).toContainEqual(
      expect.objectContaining({ path: '/config', methods: expect.arrayContaining(['get']) })
    )

    // Verify GET /host/:host exists
    expect(routePaths).toContainEqual(
      expect.objectContaining({ path: '/host/:host', methods: expect.arrayContaining(['get']) })
    )

    // Verify POST / exists
    expect(routePaths).toContainEqual(
      expect.objectContaining({ path: '/', methods: expect.arrayContaining(['post']) })
    )

    // Verify POST /host/:host exists
    expect(routePaths).toContainEqual(
      expect.objectContaining({ path: '/host/:host', methods: expect.arrayContaining(['post']) })
    )
  })

  it('config endpoint returns telnet protocol info', () => {
    const config = createTelnetEnabledConfig()
    const router = createTelnetRoutes(config)
    const handler = findConfigHandler(router)
    expect(handler).toBeDefined()

    const mockRes = createMockResponse()
    handler?.handle({}, mockRes)

    expect(mockRes.statusCode).toBe(HTTP.OK)
    expect(mockRes.body).toEqual({
      protocol: 'telnet',
      defaultPort: TELNET_DEFAULTS.PORT,
      term: TELNET_DEFAULTS.TERM,
    })
  })

  it('config endpoint uses defaults when telnet config is absent', () => {
    const secret: string = TEST_SESSION_SECRET_VALID
    const config = createDefaultConfig(secret)
    // telnet is undefined on this config
    const router = createTelnetRoutes(config)
    const handler = findConfigHandler(router)
    expect(handler).toBeDefined()

    const mockRes = createMockResponse()
    handler?.handle({}, mockRes)

    expect(mockRes.statusCode).toBe(HTTP.OK)
    expect(mockRes.body).toEqual({
      protocol: 'telnet',
      defaultPort: TELNET_DEFAULTS.PORT,
      term: TELNET_DEFAULTS.TERM,
    })
  })

  it('config endpoint sets Cache-Control no-store header', () => {
    const config = createTelnetEnabledConfig()
    const router = createTelnetRoutes(config)
    const handler = findConfigHandler(router)
    expect(handler).toBeDefined()

    const mockRes = createMockResponse()
    handler?.handle({}, mockRes)

    expect(mockRes.headers['Cache-Control']).toBe('no-store')
  })
})

describe('telnet route handler protocol injection', () => {
  it('creates exactly five route layers', () => {
    const config = createTelnetEnabledConfig()
    const router = createTelnetRoutes(config)
    const routePaths = extractRoutes(router)

    // Should have: GET /, GET /config, GET /host/:host, POST /, POST /host/:host
    expect(routePaths.length).toBe(5)
  })
})
