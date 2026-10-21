// tests/unit/security/config-credentials-target.vitest.ts
// Server-configured credentials (user.name + user.password/privateKey) must only
// ever be used for the configured ssh.host/ssh.port. URL, query and POST body
// host/port overrides must never reach an SSH connect with those credentials.

import { describe, it, expect, vi } from 'vitest'
import express, { type Application, type NextFunction, type Request, type Response } from 'express'
import request from 'supertest'
import { createRoutesV2 } from '../../../app/routes/routes-v2.js'
import { createBodyParserMiddleware } from '../../../app/middleware/body-parser.middleware.js'
import { createSSOAuthMiddleware } from '../../../app/middleware/sso.middleware.js'
import {
  CONFIG_CREDENTIALS_TARGET_ERROR,
  isConfiguredSshTarget
} from '../../../app/middleware/auth-processor.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { UnifiedAuthPipeline } from '../../../app/auth/auth-pipeline.js'
import { ServiceSocketAuthentication } from '../../../app/socket/adapters/service-socket-authentication.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from '../../../app/socket/adapters/service-socket-shared.js'
import type { ServiceSocketPrompt } from '../../../app/socket/adapters/service-socket-prompt.js'
import { SOCKET_EVENTS } from '../../../app/constants/socket-events.js'
import type { Config } from '../../../app/types/config.js'
import type { Services } from '../../../app/services/interfaces.js'
import { createMockServices, createStructuredLoggerStub } from '../../test-utils.js'
import {
  CONFIG_USERNAME,
  TEST_PASSWORD,
  TEST_SESSION_SECRET_VALID,
  TEST_USERNAME
} from '../../test-constants.js'

const CONFIGURED_HOST = 'ssh.internal.example'
const CONFIGURED_PORT = 22
const OTHER_HOST = 'other.example'
const OPERATOR_PASSWORD = 'operator-secret' //NOSONAR - test fixture

type TestSession = Record<string, unknown>

function makeConfig(overrides: { ssoEnabled?: boolean; host?: string | null } = {}): Config {
  const config = createDefaultConfig(TEST_SESSION_SECRET_VALID)
  config.ssh.host = overrides.host === undefined ? CONFIGURED_HOST : overrides.host
  config.ssh.port = CONFIGURED_PORT
  config.user.name = CONFIG_USERNAME
  config.user.password = OPERATOR_PASSWORD
  if (overrides.ssoEnabled === true) {
    config.sso.enabled = true
    config.sso.csrfProtection = false
  }
  return config
}

function makeApp(config: Config, session: TestSession): Application {
  const app = express()
  app.use((req: Request, _res: Response, next: NextFunction) => {
    ;(req as unknown as { session: TestSession }).session = session
    next()
  })
  app.use(createBodyParserMiddleware())
  if (config.sso.enabled) {
    app.use(createSSOAuthMiddleware(config))
  }
  app.use('/ssh', createRoutesV2(config))
  return app
}

function sessionCredentials(session: TestSession): Record<string, unknown> | undefined {
  return session['sshCredentials'] as Record<string, unknown> | undefined
}

function createSocketContext(config: Config, session: TestSession, services: Services): AdapterContext {
  const req = { session }
  const socket = {
    id: 'socket-1',
    emit: vi.fn(),
    request: req
  } as unknown as AdapterContext['socket']

  return {
    socket,
    config,
    services,
    authPipeline: new UnifiedAuthPipeline(req as never, config),
    state: createAdapterSharedState(),
    protocol: 'ssh',
    debug: vi.fn(),
    logger: createStructuredLoggerStub()
  }
}

function autoConnect(config: Config, session: TestSession): { services: Services; context: AdapterContext } {
  const services = createMockServices({ authSucceeds: true, sshConnectSucceeds: true }) as Services
  const context = createSocketContext(config, session, services)
  const auth = new ServiceSocketAuthentication(context, {} as ServiceSocketPrompt)
  auth.checkInitialAuth()
  return { services, context }
}

describe('server-configured credentials are pinned to ssh.host/ssh.port', () => {
  describe('GET /ssh/host routes', () => {
    it('serves the configured host with the configured credentials', async () => {
      const session: TestSession = {}
      const res = await request(makeApp(makeConfig(), session)).get(`/ssh/host/${CONFIGURED_HOST}`)

      expect(res.status).toBe(200)
      expect(sessionCredentials(session)).toMatchObject({
        username: CONFIG_USERNAME,
        host: CONFIGURED_HOST,
        port: CONFIGURED_PORT
      })
    })

    it('serves the default /ssh/host/ route with the configured credentials', async () => {
      const session: TestSession = {}
      const res = await request(makeApp(makeConfig(), session)).get('/ssh/host/')

      expect(res.status).toBe(200)
      expect(sessionCredentials(session)).toMatchObject({ host: CONFIGURED_HOST, port: CONFIGURED_PORT })
    })

    it.each([
      [`/ssh/host/${OTHER_HOST}`],
      [`/ssh/host/${OTHER_HOST}?port=2222`],
      [`/ssh/host/${CONFIGURED_HOST}?port=2222`],
      ['/ssh/host/?port=2222']
    ])('refuses %s and never points the credentials elsewhere', async (path) => {
      const session: TestSession = {}
      const res = await request(makeApp(makeConfig(), session)).get(path)

      expect(res.status).toBe(403)
      expect(res.body).toEqual({ error: CONFIG_CREDENTIALS_TARGET_ERROR })
      expect(sessionCredentials(session)).toMatchObject({ host: CONFIGURED_HOST, port: CONFIGURED_PORT })
    })

    it('refuses any URL host when ssh.host is not configured', async () => {
      const session: TestSession = {}
      const res = await request(makeApp(makeConfig({ host: null }), session)).get(`/ssh/host/${OTHER_HOST}`)

      expect(res.status).toBe(403)
      expect(sessionCredentials(session)?.['host']).toBeNull()
    })

    it('still lets user-supplied Basic Auth credentials choose the host and port', async () => {
      const session: TestSession = {}
      const res = await request(makeApp(makeConfig(), session))
        .get(`/ssh/host/${OTHER_HOST}?port=2222`)
        .auth(TEST_USERNAME, TEST_PASSWORD)

      expect(res.status).toBe(200)
      expect(sessionCredentials(session)).toMatchObject({
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        host: OTHER_HOST,
        port: 2222
      })
      expect(sessionCredentials(session)?.['credentialSource']).toBeUndefined()
    })
  })

  describe('POST routes with SSO default credentials', () => {
    it.each([
      [`/ssh/host/${OTHER_HOST}`, {}],
      ['/ssh', { host: OTHER_HOST }],
      ['/ssh', { port: '2222' }],
      [`/ssh/host/${CONFIGURED_HOST}`, { port: '2222' }],
      // The body names the configured target but the URL tries to override it
      [`/ssh/host/${OTHER_HOST}`, { host: CONFIGURED_HOST, port: '22' }],
      [`/ssh?host=${OTHER_HOST}`, { host: CONFIGURED_HOST, port: '22' }],
      [`/ssh?hostname=${OTHER_HOST}`, { host: CONFIGURED_HOST, port: '22' }],
      ['/ssh?port=2222', { host: CONFIGURED_HOST, port: '22' }],
      ['/ssh', { host: CONFIGURED_HOST, hostname: OTHER_HOST }],
      ['/ssh', { port: '22abc' }]
    ])('refuses %s %o and stores no credentials', async (path, body) => {
      const session: TestSession = {}
      const res = await request(makeApp(makeConfig({ ssoEnabled: true }), session))
        .post(path)
        .type('form')
        .send(body)

      expect(res.status).toBe(403)
      expect(res.body).toEqual({ error: CONFIG_CREDENTIALS_TARGET_ERROR })
      expect(sessionCredentials(session)).toBeUndefined()
    })

    it.each([
      [`/ssh/host/${CONFIGURED_HOST}?port=22`, { host: CONFIGURED_HOST, port: '22' }],
      [`/ssh?host=${CONFIGURED_HOST}`, {}],
      ['/ssh', { host: CONFIGURED_HOST }]
    ])('accepts %s %o when every target field names the configured target', async (path, body) => {
      const session: TestSession = {}
      const res = await request(makeApp(makeConfig({ ssoEnabled: true }), session))
        .post(path)
        .type('form')
        .send(body)

      expect(res.status).toBe(200)
      expect(sessionCredentials(session)).toMatchObject({
        host: CONFIGURED_HOST,
        port: CONFIGURED_PORT,
        credentialSource: 'config'
      })
    })

    it('accepts the configured host and marks the credentials as server-configured', async () => {
      const session: TestSession = {}
      const res = await request(makeApp(makeConfig({ ssoEnabled: true }), session))
        .post(`/ssh/host/${CONFIGURED_HOST}`)
        .type('form')
        .send({})

      expect(res.status).toBe(200)
      expect(sessionCredentials(session)).toMatchObject({
        username: CONFIG_USERNAME,
        password: OPERATOR_PASSWORD,
        host: CONFIGURED_HOST,
        port: CONFIGURED_PORT,
        credentialSource: 'config'
      })
    })

    it('still lets user-supplied POST credentials choose the host', async () => {
      const session: TestSession = {}
      const res = await request(makeApp(makeConfig({ ssoEnabled: true }), session))
        .post(`/ssh/host/${OTHER_HOST}`)
        .type('form')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD })

      expect(res.status).toBe(200)
      expect(sessionCredentials(session)).toMatchObject({ username: TEST_USERNAME, host: OTHER_HOST })
      expect(sessionCredentials(session)?.['credentialSource']).toBeUndefined()
    })
  })

  describe('socket auto-connect', () => {
    it('connects to the configured host with the configured credentials', async () => {
      const config = makeConfig()
      const session: TestSession = {}
      await request(makeApp(config, session)).get(`/ssh/host/${CONFIGURED_HOST}`)

      const { services } = autoConnect(config, session)

      await vi.waitFor(() => {
        expect(services.ssh.connect).toHaveBeenCalledTimes(1)
      })
      expect(services.ssh.connect).toHaveBeenCalledWith(expect.objectContaining({
        host: CONFIGURED_HOST,
        port: CONFIGURED_PORT,
        username: CONFIG_USERNAME,
        password: OPERATOR_PASSWORD
      }))
    })

    it.each([
      [{ host: OTHER_HOST, port: CONFIGURED_PORT }],
      [{ host: CONFIGURED_HOST, port: 2222 }]
    ])('never auto-connects server-configured credentials to %o', async (target) => {
      const config = makeConfig()
      const session: TestSession = {
        usedBasicAuth: true,
        sshCredentials: {
          username: CONFIG_USERNAME,
          password: OPERATOR_PASSWORD,
          credentialSource: 'config',
          ...target
        }
      }

      const { services, context } = autoConnect(config, session)
      await Promise.resolve()

      expect(services.auth.authenticate).not.toHaveBeenCalled()
      expect(services.ssh.connect).not.toHaveBeenCalled()
      expect(context.socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.AUTHENTICATION, { action: 'request_auth' })
    })
  })

  describe('isConfiguredSshTarget', () => {
    const config = makeConfig()

    it('matches the configured host (case-insensitive) and port', () => {
      expect(isConfiguredSshTarget(config, CONFIGURED_HOST, CONFIGURED_PORT)).toBe(true)
      expect(isConfiguredSshTarget(config, CONFIGURED_HOST.toUpperCase(), CONFIGURED_PORT)).toBe(true)
    })

    it('rejects other hosts, other ports and a missing ssh.host', () => {
      expect(isConfiguredSshTarget(config, OTHER_HOST, CONFIGURED_PORT)).toBe(false)
      expect(isConfiguredSshTarget(config, CONFIGURED_HOST, 2222)).toBe(false)
      expect(isConfiguredSshTarget(config, '', CONFIGURED_PORT)).toBe(false)
      expect(isConfiguredSshTarget(makeConfig({ host: null }), OTHER_HOST, CONFIGURED_PORT)).toBe(false)
    })
  })
})
