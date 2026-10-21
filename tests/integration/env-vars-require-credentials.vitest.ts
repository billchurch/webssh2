// tests/integration/env-vars-require-credentials.vitest.ts
// `env` is only accepted on requests that carry credentials (billchurch/webssh2#586)

import { describe, it, expect, vi } from 'vitest'
import express, { type Request, type Response } from 'express'
import session from 'express-session'
import request from 'supertest'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import { TELNET_DEFAULTS } from '../../app/constants/index.js'
import { TEST_SESSION_SECRET_VALID, TEST_USERNAME, TEST_PASSWORD } from '../test-constants.js'
import type { Config } from '../../app/types/config.js'

// Replace the page renderer with a probe that reports the stored env vars
vi.mock('../../app/connectionHandler.js', () => ({
  default: (req: Request, res: Response): void => {
    const stored = (req.session as unknown as { envVars?: Record<string, string> }).envVars
    res.status(200).json({ envVars: stored ?? null })
  },
  setHandlerThemingConfig: vi.fn()
}))

const { createRoutesV2 } = await import('../../app/routes/routes-v2.js')
const { createTelnetRoutes } = await import('../../app/routes/telnet-routes.js')

const ATTACK_ENV = 'LANG:attacker,FOO:bar'
const SSH_HOST = 'localhost'

const CONFIG_USER = 'operator'
const CONFIG_PASSWORD = 'operator-secret' //NOSONAR

function buildConfig(withConfigCredentials = false): Config {
  const config = createDefaultConfig(TEST_SESSION_SECRET_VALID)
  config.ssh.host = SSH_HOST
  if (withConfigCredentials) {
    config.user.name = CONFIG_USER
    config.user.password = CONFIG_PASSWORD
  }
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

function buildApp(withConfigCredentials = false): express.Express {
  const config = buildConfig(withConfigCredentials)
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(session({ secret: TEST_SESSION_SECRET_VALID, resave: false, saveUninitialized: true }))
  app.use('/ssh', createRoutesV2(config))
  app.use('/telnet', createTelnetRoutes(config))
  return app
}

type Agent = ReturnType<typeof request.agent>

async function storedEnv(
  pending: ReturnType<Agent['get']>
): Promise<Record<string, string> | null> {
  const res = await pending
  expect(res.status).toBe(200)
  return (res.body as { envVars: Record<string, string> | null }).envVars
}

function seedWithCredentials(agent: Agent, env: string): ReturnType<Agent['get']> {
  return agent
    .get(`/ssh/host/${SSH_HOST}`)
    .query({ env })
    .auth(TEST_USERNAME, TEST_PASSWORD)
}

describe('env vars require credentials on the same request (#586)', () => {
  describe('unauthenticated routes do not store env', () => {
    it.each([
      ['GET /ssh/', '/ssh/'],
      ['GET /telnet/', '/telnet/'],
      ['GET /telnet/host/localhost', '/telnet/host/localhost'],
    ])('%s ignores ?env=', async (_label, path) => {
      const agent = request.agent(buildApp())
      expect(await storedEnv(agent.get(path).query({ env: ATTACK_ENV }))).toBeNull()
    })

    it.each([
      ['POST /telnet/', '/telnet/'],
      ['POST /telnet/host/localhost', '/telnet/host/localhost'],
    ])('%s ignores ?env=', async (_label, path) => {
      const agent = request.agent(buildApp())
      const res = await agent.post(path).query({ env: ATTACK_ENV }).send({})
      expect(res.status).toBe(200)
      expect((res.body as { envVars: unknown }).envVars).toBeNull()
    })
  })

  describe('a crafted link cannot pre-seed a later login', () => {
    it('credentialed POST /ssh/ without env sends no env after GET /ssh/?env=', async () => {
      const agent = request.agent(buildApp())
      await storedEnv(agent.get('/ssh/').query({ env: ATTACK_ENV }))

      const res = await agent
        .post('/ssh/')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD, host: SSH_HOST })
      expect(res.status).toBe(200)
      expect((res.body as { envVars: unknown }).envVars).toBeNull()
    })

    it('Basic-auth GET /ssh/host/:host without env sends no env after GET /telnet/?env=', async () => {
      const agent = request.agent(buildApp())
      await storedEnv(agent.get('/telnet/').query({ env: ATTACK_ENV }))

      const env = await storedEnv(
        agent.get(`/ssh/host/${SSH_HOST}`).auth(TEST_USERNAME, TEST_PASSWORD)
      )
      expect(env).toBeNull()
    })

    it('a later login replaces env vars from an earlier login', async () => {
      const agent = request.agent(buildApp())
      expect(await storedEnv(seedWithCredentials(agent, 'LANG:C'))).toEqual({ LANG: 'C' })

      const res = await agent
        .post('/ssh/')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD, host: SSH_HOST })
      expect((res.body as { envVars: unknown }).envVars).toBeNull()
    })

    it('an unauthenticated GET /ssh/ clears env vars kept from an earlier login', async () => {
      const agent = request.agent(buildApp())
      await storedEnv(seedWithCredentials(agent, 'LANG:C'))

      expect(await storedEnv(agent.get('/ssh/'))).toBeNull()
    })
  })

  describe('operator-configured credentials do not count as request credentials', () => {
    it.each([
      ['GET /ssh/host/', '/ssh/host/'],
      ['GET /ssh/host/localhost', `/ssh/host/${SSH_HOST}`],
    ])('%s without Authorization ignores ?env=', async (_label, path) => {
      const agent = request.agent(buildApp(true))
      expect(await storedEnv(agent.get(path).query({ env: ATTACK_ENV }))).toBeNull()
    })

    it('anonymous GET /ssh/host/localhost clears env from an earlier credentialed login', async () => {
      const agent = request.agent(buildApp(true))
      expect(await storedEnv(seedWithCredentials(agent, 'LANG:C'))).toEqual({ LANG: 'C' })

      expect(await storedEnv(agent.get(`/ssh/host/${SSH_HOST}`))).toBeNull()
    })

    it('Basic-auth GET /ssh/host/localhost still stores ?env=', async () => {
      const agent = request.agent(buildApp(true))
      expect(await storedEnv(seedWithCredentials(agent, 'LANG:C'))).toEqual({ LANG: 'C' })
    })

    it('POST /ssh/ without body credentials is rejected and stores nothing', async () => {
      const agent = request.agent(buildApp(true))
      const res = await agent.post('/ssh/').query({ env: ATTACK_ENV }).send({ host: SSH_HOST })
      expect(res.status).toBe(400)

      expect(await storedEnv(agent.get('/ssh/'))).toBeNull()
    })
  })

  describe('credentialed routes accept env', () => {
    it('Basic-auth GET /ssh/host/:host stores ?env=', async () => {
      const agent = request.agent(buildApp())
      expect(await storedEnv(seedWithCredentials(agent, ATTACK_ENV))).toEqual({
        LANG: 'attacker',
        FOO: 'bar',
      })
    })

    it('POST /ssh/ with credentials stores env from the body', async () => {
      const agent = request.agent(buildApp())
      const res = await agent
        .post('/ssh/')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD, host: SSH_HOST, env: 'LANG:C' })
      expect(res.status).toBe(200)
      expect((res.body as { envVars: unknown }).envVars).toEqual({ LANG: 'C' })
    })
  })
})
