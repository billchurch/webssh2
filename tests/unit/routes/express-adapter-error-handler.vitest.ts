// tests/unit/routes/express-adapter-error-handler.vitest.ts

import { describe, it, expect, vi } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import request from 'supertest'
import {
  createErrorHandler,
  asyncRouteHandler,
  type RouteErrorLogger
} from '../../../app/routes/adapters/express-adapter.js'
import { createRoutesV2 } from '../../../app/routes/routes-v2.js'
import { createTelnetRoutes } from '../../../app/routes/telnet-routes.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { HTTP } from '../../../app/constants/index.js'
import { ConfigError } from '../../../app/errors.js'
import { TEST_SESSION_SECRET_VALID } from '@tests/test-constants.js'

const SECRET_PATH = '/secret/path/template.html'
const TEST_SECRET: string = TEST_SESSION_SECRET_VALID

function namedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

function createTestApp(error: Error, logError: RouteErrorLogger): express.Application {
  const app = express()
  app.get('/boom', asyncRouteHandler(() => Promise.reject(error)))
  app.use(createErrorHandler({ logError }))
  return app
}

function mountRouter(router: express.Router): express.Application {
  const app = express()
  app.use(router)
  return app
}

describe('createErrorHandler', () => {
  it('returns a generic 500 body for an unexpected error', async () => {
    const logError = vi.fn<RouteErrorLogger>()
    const app = createTestApp(new Error(`${SECRET_PATH} not found`), logError)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(HTTP.INTERNAL_SERVER_ERROR)
    expect(response.body).toEqual({
      error: HTTP.INTERNAL_ERROR_MESSAGE,
      type: HTTP.INTERNAL_ERROR_TYPE
    })
    expect(response.text).not.toContain('/secret/path')
  })

  it('logs the original error on the server for a 500', async () => {
    const logError = vi.fn<RouteErrorLogger>()
    const error = new Error(`${SECRET_PATH} not found`)
    const app = createTestApp(error, logError)

    await request(app).get('/boom')

    expect(logError).toHaveBeenCalledTimes(1)
    const [message, loggedError, context] = logError.mock.calls[0] ?? []
    expect(message).toBe('Unhandled route error')
    expect(loggedError).toBe(error)
    expect(loggedError?.message).toContain(SECRET_PATH)
    expect(context).toMatchObject({ reason: 'Error' })
  })

  it('returns the generic body for a ConfigError', async () => {
    const logError = vi.fn<RouteErrorLogger>()
    const app = createTestApp(new ConfigError(`Invalid config at ${SECRET_PATH}`), logError)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(HTTP.INTERNAL_SERVER_ERROR)
    expect(response.body).toEqual({
      error: HTTP.INTERNAL_ERROR_MESSAGE,
      type: HTTP.INTERNAL_ERROR_TYPE
    })
    expect(response.text).not.toContain('/secret/path')
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError.mock.calls[0]?.[2]).toMatchObject({ reason: 'ConfigError' })
  })

  it('keeps the ValidationError message and returns 400', async () => {
    const logError = vi.fn<RouteErrorLogger>()
    const app = createTestApp(namedError('ValidationError', 'Port must be a number'), logError)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(HTTP.BAD_REQUEST)
    expect(response.body).toEqual({ error: 'Port must be a number', type: 'ValidationError' })
    expect(logError).not.toHaveBeenCalled()
  })

  it('keeps the AuthenticationError message and returns 401', async () => {
    const logError = vi.fn<RouteErrorLogger>()
    const app = createTestApp(namedError('AuthenticationError', 'Invalid credentials'), logError)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(HTTP.UNAUTHORIZED)
    expect(response.body).toEqual({ error: 'Invalid credentials', type: 'AuthenticationError' })
    expect(logError).not.toHaveBeenCalled()
  })

  it('keeps a 4xx status set on the error and sends only the status text', async () => {
    const logError = vi.fn<RouteErrorLogger>()
    const error = Object.assign(new URIError("Failed to decode param '%ZZ'"), { status: 400 })
    const app = createTestApp(error, logError)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(HTTP.BAD_REQUEST)
    expect(response.body).toEqual({ error: 'Bad Request', type: 'URIError' })
    expect(response.text).not.toContain('%ZZ')
    expect(logError).not.toHaveBeenCalled()
  })

  it('keeps a 5xx status set on the error but sends the generic body', async () => {
    const logError = vi.fn<RouteErrorLogger>()
    const error = Object.assign(new Error(`${SECRET_PATH} unavailable`), { statusCode: 503 })
    const app = createTestApp(error, logError)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({
      error: HTTP.INTERNAL_ERROR_MESSAGE,
      type: HTTP.INTERNAL_ERROR_TYPE
    })
    expect(logError).toHaveBeenCalledTimes(1)
  })

  it('ignores a status outside the error range', async () => {
    const logError = vi.fn<RouteErrorLogger>()
    const error = Object.assign(new Error('odd status'), { status: 200 })
    const app = createTestApp(error, logError)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(HTTP.INTERNAL_SERVER_ERROR)
    expect(response.body).toEqual({
      error: HTTP.INTERNAL_ERROR_MESSAGE,
      type: HTTP.INTERNAL_ERROR_TYPE
    })
  })

  it('logs but does not write when headers were already sent', () => {
    const logError = vi.fn<RouteErrorLogger>()
    const handler = createErrorHandler({ logError })
    const status = vi.fn()
    const res = { headersSent: true, status } as unknown as Response

    handler(new Error('late failure'), {} as Request, res, vi.fn() as NextFunction)

    expect(logError).toHaveBeenCalledTimes(1)
    expect(status).not.toHaveBeenCalled()
  })
})

describe('route error handler placement', () => {
  type Layer = { route?: unknown; handle: { length: number } }

  const lastLayer = (router: unknown): Layer | undefined => {
    const stack = (router as { stack: Layer[] }).stack
    return stack.at(-1)
  }

  it('registers the error handler after the SSH routes', () => {
    const router = createRoutesV2(createDefaultConfig(TEST_SECRET))
    const layer = lastLayer(router)

    expect(layer?.route).toBeUndefined()
    expect(layer?.handle.length).toBe(4)
  })

  it('registers the error handler after the telnet routes', () => {
    const router = createTelnetRoutes(createDefaultConfig(TEST_SECRET))
    const layer = lastLayer(router)

    expect(layer?.route).toBeUndefined()
    expect(layer?.handle.length).toBe(4)
  })

  it.each(['/host/%ZZ', '/host/%E0%A4%A'])(
    'returns 400 from the SSH routes for a malformed host URL %s',
    async (path) => {
      const app = mountRouter(createRoutesV2(createDefaultConfig(TEST_SECRET)))

      const response = await request(app).get(path)

      expect(response.status).toBe(HTTP.BAD_REQUEST)
      expect(response.body).toEqual({ error: 'Bad Request', type: 'URIError' })
    }
  )

  it.each(['/host/%ZZ', '/host/%E0%A4%A'])(
    'returns 400 from the telnet routes for a malformed host URL %s',
    async (path) => {
      const app = mountRouter(createTelnetRoutes(createDefaultConfig(TEST_SECRET)))

      const response = await request(app).get(path)

      expect(response.status).toBe(HTTP.BAD_REQUEST)
      expect(response.body).toEqual({ error: 'Bad Request', type: 'URIError' })
    }
  )
})
