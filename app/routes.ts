// server
// app/routes.ts

import express, { type Router, type Request, type Response } from 'express'
import {
  getValidatedHost,
  getValidatedPort,
  maskSensitiveData,
  validateSshTerm,
  parseEnvVars,
  pickField,
} from './utils.js'
import { DEFAULTS } from './constants.js'
import handleConnection from './connectionHandler.js'
import { createNamespacedDebug } from './logger.js'
import { createAuthMiddleware } from './middleware.js'
import { ConfigError, handleError } from './errors.js'
import { HTTP } from './constants.js'
import type { Config } from './types/config.js'

const debug = createNamespacedDebug('routes')

type Sess = {
  headerOverride?: { text?: unknown; background?: unknown; style?: unknown }
  sshCredentials?: {
    host?: string
    port?: number
    username?: string
    password?: string
    term?: string | null
  }
  usedBasicAuth?: boolean
  allowReplay?: boolean
  mrhSession?: unknown
  readyTimeout?: number
  authMethod?: string
  [k: string]: unknown
}

export function processHeaderParameters(
  source: Record<string, unknown> | undefined,
  session: Sess
): void {
  const src = source ?? {}
  const isGet = !!(
    Object.prototype.hasOwnProperty.call(src, 'header') ||
    Object.prototype.hasOwnProperty.call(src, 'headerBackground') ||
    Object.prototype.hasOwnProperty.call(src, 'headerStyle')
  )

  let headerVal: unknown
  let backgroundVal: unknown
  let styleVal: unknown

  if (isGet) {
    const { header, headerBackground, headerStyle } = src as Record<string, unknown>
    headerVal = header
    backgroundVal = headerBackground
    styleVal = headerStyle
  } else if (source) {
    headerVal = (source as Record<string, unknown>)['header.name']
    backgroundVal = (source as Record<string, unknown>)['header.background']
    const colorVal = (source as Record<string, unknown>)['header.color'] as string | undefined
    styleVal = colorVal ? `color: ${colorVal}` : undefined
  }

  if (headerVal || backgroundVal || styleVal) {
    session.headerOverride ??= {}
    if (headerVal) {
      session.headerOverride.text = headerVal
      debug('Header text from %s: %s', isGet ? 'URL parameter' : 'POST', headerVal)
    }
    if (backgroundVal) {
      session.headerOverride.background = backgroundVal
      debug('Header background from %s: %s', isGet ? 'URL parameter' : 'POST', backgroundVal)
    }
    if (styleVal) {
      session.headerOverride.style = styleVal
      debug('Header style from %s: %s', isGet ? 'URL parameter' : 'POST', styleVal)
    }
    debug('Header override set in session: %O', session.headerOverride)
  }
}

export function processEnvironmentVariables(source: Record<string, unknown>, session: Sess): void {
  const envVars = parseEnvVars((source as Record<string, unknown>)['env'] as string | undefined)
  if (envVars) {
    ;(session as Record<string, unknown>)['envVars'] = envVars
    debug('routes: Parsed environment variables: %O', envVars)
  }
}

export function setupSshCredentials(
  session: Sess,
  opts: { host: string; port: number; username?: string; password?: string; term?: string | null }
): unknown {
  session.sshCredentials ??= {}
  session.sshCredentials.host = opts.host
  session.sshCredentials.port = opts.port
  if (opts.username) {
    session.sshCredentials.username = opts.username
  }
  if (opts.password) {
    session.sshCredentials.password = opts.password
  }
  if (opts.term) {
    session.sshCredentials.term = opts.term
  }
  session.usedBasicAuth = true

  const sanitized = maskSensitiveData(
    JSON.parse(JSON.stringify(session['sshCredentials']))
  ) as unknown
  return sanitized
}

export function processSessionRecordingParams(body: Record<string, unknown>, session: Sess): void {
  if (body['allowreplay'] === 'true' || body['allowreplay'] === true) {
    session.allowReplay = true
  }
  if (body['mrhsession']) {
    session.mrhSession = body['mrhsession']
  }
  if (body['readyTimeout']) {
    session.readyTimeout = parseInt(body['readyTimeout'] as string, 10)
  }
}

export function handleRouteError(
  err: Error,
  res: { status: (c: number) => { send: (b: unknown) => void; json: (b: unknown) => void } }
): void {
  const error = new ConfigError(`Invalid configuration: ${err.message}`)
  handleError(
    error,
    res as unknown as {
      status: (c: number) => { send: (b: unknown) => void; json: (b: unknown) => void }
    }
  )
}

type ReqWithSession = Request & {
  session: Sess
  query: Record<string, unknown>
  params: Record<string, string>
  body: Record<string, unknown>
  headers: Record<string, unknown>
}

function handlePostAuthentication(
  req: ReqWithSession,
  res: Response,
  hostParam: string | null,
  config: Config
): void {
  try {
    const username = pickField(
      req.body['username'] as string | undefined,
      req.headers[DEFAULTS.SSO_HEADERS.USERNAME] as string | undefined
    )
    const password = pickField(
      req.body['password'] as string | undefined,
      req.headers[DEFAULTS.SSO_HEADERS.PASSWORD] as string | undefined
    )
    if (!username || !password) {
      return void res.status(HTTP.UNAUTHORIZED).send('Username and password required')
    }

    let host: string
    if (hostParam) {
      host = getValidatedHost(hostParam)
    } else {
      if (!config.ssh.host) {
        throw new ConfigError('Host parameter required when default host not configured')
      }
      host = pickField(req.body['host'] as string | undefined, config.ssh.host)!
    }

    const port = getValidatedPort(req.body['port'] as string | undefined)
    const sshterm = validateSshTerm(req.body['sshterm'] as string | undefined)

    processHeaderParameters(req.body, req.session)
    processEnvironmentVariables(req.body, req.session)

    const sanitizedCredentials = setupSshCredentials(req.session, {
      host,
      port,
      username,
      password,
      term: sshterm,
    })

    req.session.authMethod = 'POST'
    const routePath = hostParam ? `/ssh/host/:host POST` : `/ssh/host/ POST`
    debug(`${routePath} Credentials: `, sanitizedCredentials)

    processSessionRecordingParams(req.body, req.session)
    void handleConnection(req, res, { host })
  } catch (err) {
    handleRouteError(err as Error, res)
  }
}

export function createRoutes(config: Config): Router {
  const router = express.Router()
  const auth = createAuthMiddleware(config)

  router.get('/', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug('router.get./: Accessed / route')
    // Also allow env vars via /ssh?env=FOO:bar
    processEnvironmentVariables(r.query, r.session)
    processHeaderParameters(r.query, r.session)
    void handleConnection(
      req as unknown as Request & { session?: Record<string, unknown>; sessionID?: string },
      res as Response
    )
  })

  router.get('/host/', auth, (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug(`router.get.host: /ssh/host/ route`)
    processEnvironmentVariables(r.query, r.session)
    processHeaderParameters(r.query, r.session)
    try {
      if (!config.ssh.host) {
        throw new ConfigError('Host parameter required when default host not configured')
      }
      const { host } = config.ssh
      const port = getValidatedPort(r.query['port'] as string | undefined)
      const sshterm = validateSshTerm(r.query['sshterm'] as string | undefined)
      const sanitizedCredentials = setupSshCredentials(r.session, {
        host,
        port,
        term: (r.query['sshterm'] ? sshterm : null) ?? null,
      })
      debug('/ssh/host/ Credentials: ', sanitizedCredentials)
      void handleConnection(
        req as unknown as Request & { session?: Record<string, unknown>; sessionID?: string },
        res as Response,
        { host }
      )
    } catch (err) {
      handleRouteError(err as Error, res)
    }
  })

  router.get('/host/:host', auth, (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug(`router.get.host: /ssh/host/${String((req as Request).params['host'])} route`)
    processEnvironmentVariables(r.query, r.session)
    processHeaderParameters(r.query, r.session)
    try {
      const host = getValidatedHost(r.params['host'] as string)
      const port = getValidatedPort(r.query['port'] as string | undefined)
      const sshterm = validateSshTerm(r.query['sshterm'] as string | undefined)
      const sanitizedCredentials = setupSshCredentials(r.session, {
        host,
        port,
        term: (r.query['sshterm'] ? sshterm : null) ?? null,
      })
      debug('/ssh/host/ Credentials: ', sanitizedCredentials)
      void handleConnection(
        req as unknown as Request & { session?: Record<string, unknown>; sessionID?: string },
        res as Response,
        { host }
      )
    } catch (err) {
      handleRouteError(err as Error, res)
    }
  })

  router.post('/host/', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug(`router.post.host: /ssh/host/ route`)
    handlePostAuthentication(r, res, null, config)
  })

  router.post('/host/:host', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug(`router.post.host: /ssh/host/${String((req as Request).params['host'])} route`)
    handlePostAuthentication(r, res, r.params['host'] as string, config)
  })

  router.get('/clear-credentials', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    delete (r.session as Record<string, unknown>)['sshCredentials']
    res.status(HTTP.OK).send(HTTP.CREDENTIALS_CLEARED)
  })

  router.get('/force-reconnect', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    delete (r.session as Record<string, unknown>)['sshCredentials']
    res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
  })

  return router
}
