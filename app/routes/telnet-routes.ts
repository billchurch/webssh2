// app/routes/telnet-routes.ts
// Telnet routes mirroring the SSH route pattern

import express, { type Router, type Request, type Response } from 'express'
import handleConnection from '../connectionHandler.js'
import { createNamespacedDebug } from '../logger.js'
import { HTTP, TELNET_DEFAULTS } from '../constants/index.js'
import type { Config } from '../types/config.js'
import { processAuthParameters, type AuthSession } from '../auth/auth-utils.js'
import { asyncRouteHandler, createErrorHandler } from './adapters/express-adapter.js'

const debug = createNamespacedDebug('routes:telnet')

type ExpressRequest = Request & {
  session: AuthSession & Record<string, unknown>
  sessionID: string
}

/**
 * Create telnet routes with protocol-specific configuration.
 * Mirrors the SSH route structure but simplified for telnet connections.
 */
export function createTelnetRoutes(config: Config): Router {
  const router = express.Router()

  // Add error handler
  router.use(createErrorHandler())

  /**
   * Root route - full connection mode, protocol: telnet
   */
  router.get('/', asyncRouteHandler(async (req: Request, res: Response) => {
    const expressReq = req as unknown as ExpressRequest
    debug('GET / - Telnet root route accessed')

    processAuthParameters(expressReq.query, expressReq.session)
    await handleConnection(
      expressReq as unknown as Request & { session?: AuthSession; sessionID?: string },
      res,
      { connectionMode: 'full', protocol: 'telnet' }
    )
  }))

  /**
   * Expose telnet server configuration to clients
   */
  router.get('/config', (_req: Request, res: Response) => {
    debug('GET /config - Telnet config endpoint')
    const telnetConfig = config.telnet
    res.setHeader('Cache-Control', 'no-store')
    res.status(HTTP.OK).json({
      protocol: 'telnet',
      defaultPort: telnetConfig?.defaultPort ?? TELNET_DEFAULTS.PORT,
      term: telnetConfig?.term ?? TELNET_DEFAULTS.TERM,
    })
  })

  /**
   * Host route with parameter - host-locked mode
   */
  router.get('/host/:host', asyncRouteHandler(async (req: Request, res: Response) => {
    const expressReq = req as unknown as ExpressRequest
    const hostParam = expressReq.params['host']
    const host = typeof hostParam === 'string' ? hostParam : undefined
    debug(`GET /host/${host ?? 'unknown'} - Telnet host-locked route`)

    processAuthParameters(expressReq.query, expressReq.session)

    const portParam = expressReq.query['port']
    const parsedPort = typeof portParam === 'string' && portParam !== ''
      ? Number(portParam)
      : NaN
    const lockedPort = Number.isFinite(parsedPort) ? parsedPort : TELNET_DEFAULTS.PORT

    await handleConnection(
      expressReq as unknown as Request & { session?: AuthSession; sessionID?: string },
      res,
      {
        protocol: 'telnet',
        connectionMode: 'host-locked',
        ...(host === undefined ? {} : { lockedHost: host, host }),
        lockedPort,
      }
    )
  }))

  /**
   * POST root - SSO form submission for telnet
   */
  router.post('/', asyncRouteHandler(async (req: Request, res: Response) => {
    const expressReq = req as unknown as ExpressRequest
    debug('POST / - Telnet SSO form submission')

    const body = expressReq.body as Record<string, unknown> | undefined
    const host = typeof body?.['host'] === 'string' ? body['host'] : undefined

    processAuthParameters(expressReq.query, expressReq.session)
    await handleConnection(
      expressReq as unknown as Request & { session?: AuthSession; sessionID?: string },
      res,
      {
        protocol: 'telnet',
        connectionMode: 'full',
        ...(host === undefined ? {} : { host }),
      }
    )
  }))

  /**
   * POST /host/:host - SSO form submission with host locked
   */
  router.post('/host/:host', asyncRouteHandler(async (req: Request, res: Response) => {
    const expressReq = req as unknown as ExpressRequest
    const hostParam = expressReq.params['host']
    const host = typeof hostParam === 'string' ? hostParam : undefined
    debug(`POST /host/${host ?? 'unknown'} - Telnet SSO form with host`)

    processAuthParameters(expressReq.query, expressReq.session)
    await handleConnection(
      expressReq as unknown as Request & { session?: AuthSession; sessionID?: string },
      res,
      {
        protocol: 'telnet',
        connectionMode: 'host-locked',
        ...(host === undefined ? {} : { lockedHost: host, host }),
      }
    )
  }))

  return router
}
