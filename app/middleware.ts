import type { Request, Response, NextFunction, RequestHandler, Application } from 'express'
import session from 'express-session'
import bodyParser from 'body-parser'
import basicAuth from 'basic-auth'
import validator from 'validator'
import { HTTP, DEFAULTS } from './constants.js'
import { createSecurityHeadersMiddleware } from './security-headers.js'
import type { Config } from './types/config.js'

const { urlencoded, json } = bodyParser

export function createAuthMiddleware(config: Config): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = req as Request & { session?: Record<string, unknown> }
    // Config-supplied credentials take precedence
    if (config.user.name && (config.user.password || config.user.privateKey)) {
      const creds: Record<string, unknown> = { username: config.user.name }
      if (config.user.privateKey) {
        creds['privateKey'] = config.user.privateKey
      }
      if (config.user.password) {
        creds['password'] = config.user.password
      }
      r.session['sshCredentials'] = creds
      r.session['usedBasicAuth'] = true
      return next()
    }

    const credentials = basicAuth(req)
    if (!credentials) {
      res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
      return res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
    }
    // session is expected to exist (session middleware precedes this)
    r.session['sshCredentials'] = {
      username: validator.escape(credentials.name ?? ''),
      password: credentials.pass,
    }
    r.session['usedBasicAuth'] = true
    next()
  }
}

export function createSessionMiddleware(config: Config): RequestHandler {
  return session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: true,
    name: config.session.name,
  })
}

export function createBodyParserMiddleware(): RequestHandler[] {
  return [urlencoded({ extended: true }), json()]
}

export function createCookieMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = req as Request & { session?: Record<string, unknown> }
    const s = r.session as Record<string, unknown>
    const creds = s['sshCredentials'] as { host?: string; port?: number } | undefined
    if (creds) {
      const cookieData = { host: creds.host, port: creds.port }
      res.cookie(HTTP.COOKIE, JSON.stringify(cookieData), {
        httpOnly: false,
        path: HTTP.PATH,
        sameSite: HTTP.SAMESITE_POLICY.toLowerCase() as 'strict',
      })
    }
    next()
  }
}

export function createSSOAuthMiddleware(config: Config): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.method !== 'POST') {
      return next()
    }

    if (req.headers[DEFAULTS.SSO_HEADERS.USERNAME] && req.headers[DEFAULTS.SSO_HEADERS.PASSWORD]) {
      return next()
    }

    const body = (req as Request & { body?: Record<string, unknown> }).body
    if (body?.username && body?.password) {
      return next()
    }

    if (config.sso.enabled && config.user.name && config.user.password) {
      const r = req as Request & { body?: Record<string, unknown> }
      r.body ??= {}
      r.body.username = r.body.username ?? config.user.name
      r.body.password = r.body.password ?? config.user.password
      return next()
    }

    next()
  }
}

export function createCSRFMiddleware(config: Config): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.sso.csrfProtection) {
      return next()
    }

    if (config.sso.trustedProxies.length > 0) {
      const clientIp = (req.ip ?? (req.connection as { remoteAddress?: string }).remoteAddress) as
        | string
        | undefined
      if (clientIp && config.sso.trustedProxies.includes(clientIp)) {
        return next()
      }
    }

    if (req.headers[DEFAULTS.SSO_HEADERS.USERNAME] || req.headers[DEFAULTS.SSO_HEADERS.SESSION]) {
      return next()
    }

    if (req.method === 'POST') {
      const r = req as Request & {
        session?: Record<string, unknown>
        body?: Record<string, unknown>
      }
      const token = (r.body?._csrf as unknown) ?? req.headers['x-csrf-token']
      const sessionToken = (r.session as Record<string, unknown>)['csrfToken'] as unknown
      if (!sessionToken || token !== sessionToken) {
        return res.status(HTTP.FORBIDDEN).send('CSRF token validation failed')
      }
    }
    next()
  }
}

export function applyMiddleware(
  app: Application,
  config: Config
): {
  sessionMiddleware: RequestHandler
} {
  app.use(createSecurityHeadersMiddleware(config))
  const sessionMiddleware = createSessionMiddleware(config)
  app.use(sessionMiddleware)
  app.use(createBodyParserMiddleware())
  if (config.sso.enabled) {
    app.use(createCSRFMiddleware(config))
    app.use(createSSOAuthMiddleware(config))
  }
  app.use(createCookieMiddleware())
  return { sessionMiddleware }
}
