// app/routes/routes-v2.ts
// Refactored routes using pure handlers and adapters

import express, { type Router, type Request, type Response } from 'express'
import handleConnection from '../connectionHandler.js'
import { createNamespacedDebug } from '../logger.js'
import { createAuthMiddleware } from '../middleware.js'
import { processAuthParameters } from '../auth/auth-utils.js'
import { validateSshCredentials } from '../connection/index.js'
import { HTTP } from '../constants.js'
import type { Config } from '../types/config.js'
import type { AuthSession } from '../auth/auth-utils.js'

// Import pure handlers
import {
  validateSshRouteCredentials,
  processSshValidationResult,
  processPostAuthRequest,
  createAuthSessionUpdates,
  processReauthRequest,
  validateConnectionParameters,
  sanitizeCredentialsForLogging,
  type SshRouteRequest
} from './handlers/ssh-handler.js'

// Import adapters
import {
  createRouteHandler,
  asyncRouteHandler,
  createErrorHandler,
  extractRouteRequest,
  applyRouteResponse
} from './adapters/express-adapter.js'

const debug = createNamespacedDebug('routes:v2')

type ExpressRequest = Request & {
  session: AuthSession & Record<string, unknown>
  sessionID: string
}

/**
 * Internal helper to handle SSH GET route logic
 */
async function handleSshGetRoute(
  req: Request,
  res: Response,
  config: Config,
  hostOverride?: string
): Promise<void> {
  const expressReq = req as unknown as ExpressRequest
  const routeRequest = extractRouteRequest(expressReq)

  // Validate credentials
  const credResult = validateSshRouteCredentials(routeRequest.session.sshCredentials)
  if (!credResult.ok) {
    applyRouteResponse({
      status: HTTP.UNAUTHORIZED,
      headers: { [HTTP.AUTHENTICATE]: HTTP.REALM },
      data: { error: credResult.error.message }
    }, res)
    return
  }

  // Build connection parameters
  const portParam = routeRequest.query['port'] as string | undefined
  const termParam = routeRequest.query['sshterm'] as string | undefined
  const connectionParams: Record<string, string> = {}

  if (hostOverride != null && hostOverride !== '') {
    connectionParams['host'] = hostOverride
  }
  if (portParam != null && portParam !== '') {
    connectionParams['port'] = portParam
  }
  if (termParam != null && termParam !== '') {
    connectionParams['term'] = termParam
  }

  // Validate connection parameters
  const connResult = validateConnectionParameters(connectionParams, config)
  if (!connResult.ok) {
    applyRouteResponse({
      status: 400,
      data: { error: connResult.error.message }
    }, res)
    return
  }

  // Validate SSH connection
  const validationResult = await validateSshCredentials(
    connResult.value.host,
    connResult.value.port,
    credResult.value.username,
    credResult.value.password,
    config
  )

  if (!validationResult.success) {
    const errorResponse = processSshValidationResult(
      validationResult,
      connResult.value.host,
      connResult.value.port
    )
    applyRouteResponse(errorResponse, res)
    return
  }

  // Log sanitized credentials
  const sanitized = sanitizeCredentialsForLogging(credResult.value, connResult.value)
  debug('SSH validation passed:', sanitized)

  // Update session credentials with host, port, and term from URL for socket auto-connection
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-optional-chain
  if (expressReq.session != null && expressReq.session.sshCredentials != null) {
    expressReq.session.sshCredentials = {
      ...expressReq.session.sshCredentials,
      host: connResult.value.host,
      port: connResult.value.port,
      ...(connResult.value.term != null && { term: connResult.value.term })
    }
    debug('Updated session credentials with host/port/term from URL')
  }

  // Process auth and serve client
  processAuthParameters(routeRequest.query, expressReq.session)
  await handleConnection(
    expressReq as unknown as Request & { session?: AuthSession; sessionID?: string },
    res,
    { host: connResult.value.host }
  )
}

/**
 * Internal helper to handle POST authentication route logic
 */
async function handlePostAuthRoute(
  req: Request,
  res: Response,
  config: Config,
  hostOverride?: string
): Promise<void> {
  const expressReq = req as unknown as ExpressRequest
  const routeRequest = extractRouteRequest(expressReq)

  // Merge host from URL into body if not present
  const bodyWithHost = {
    ...(routeRequest.body ?? {}),
    ...(hostOverride != null && routeRequest.body?.['host'] == null
      ? { host: hostOverride }
      : {})
  }

  // Process POST authentication request
  const authResult = processPostAuthRequest(
    bodyWithHost,
    routeRequest.query,
    config
  )

  if (!authResult.ok) {
    applyRouteResponse({
      status: 400,
      data: { error: authResult.error.message }
    }, res)
    return
  }

  // Create and apply session updates
  const sessionUpdates = createAuthSessionUpdates(
    authResult.value.credentials,
    authResult.value.connection
  )
  Object.assign(expressReq.session, sessionUpdates)

  // Log sanitized data
  const sanitized = sanitizeCredentialsForLogging(
    authResult.value.credentials,
    authResult.value.connection
  )
  debug('POST auth - Credentials stored:', sanitized)

  // Serve the client page
  await handleConnection(
    expressReq as unknown as Request & { session?: AuthSession; sessionID?: string },
    res,
    { host: authResult.value.connection.host }
  )
}

/**
 * Create routes with pure handler architecture
 */
export function createRoutesV2(config: Config): Router {
  const router = express.Router()
  const auth = createAuthMiddleware(config)
  
  // Add error handler
  router.use(createErrorHandler())

  /**
   * Root route - uses default config
   */
  router.get('/', asyncRouteHandler(async (req: Request, res: Response) => {
    const expressReq = req as unknown as ExpressRequest
    debug('GET / - Root route accessed')
    
    processAuthParameters(expressReq.query, expressReq.session)
    await handleConnection(expressReq as unknown as Request & { session?: AuthSession; sessionID?: string }, res)
  }))

  /**
   * Host route without parameter - uses config default
   */
  router.get('/host/', auth, asyncRouteHandler(async (req: Request, res: Response) => {
    debug('GET /host/ - Default host route')
    await handleSshGetRoute(req, res, config)
  }))

  /**
   * Host route with parameter
   */
  router.get('/host/:host', auth, asyncRouteHandler(async (req: Request, res: Response) => {
    const expressReq = req as unknown as ExpressRequest
    const hostParam = expressReq.params['host']
    debug(`GET /host/${hostParam} - Specific host route`)
    await handleSshGetRoute(req, res, config, hostParam)
  }))

  /**
   * POST authentication route for SSO/API integration
   */
  router.post('/', asyncRouteHandler(async (req: Request, res: Response) => {
    debug('POST / - SSO authentication route')
    await handlePostAuthRoute(req, res, config)
  }))

  /**
   * POST /host/:host route for SSO forms that post to specific host endpoints
   * Allows posting to /ssh/host/:host (when mounted under /ssh)
   */
  router.post('/host/:host', asyncRouteHandler(async (req: Request, res: Response) => {
    const expressReq = req as unknown as ExpressRequest
    const hostParam = expressReq.params['host']
    debug(`POST /host/${hostParam} - SSO authentication route with host`)
    await handlePostAuthRoute(req, res, config, hostParam)
  }))

  /**
   * Clear credentials route
   */
  router.get('/clear-credentials', createRouteHandler(
    (_request: SshRouteRequest) => {
      debug('Clearing SSH credentials from session')
      return {
        ok: true as const,
        value: {
          status: HTTP.OK,
          data: { message: HTTP.CREDENTIALS_CLEARED }
        }
      }
    },
    config
  ))

  /**
   * Force reconnect route
   */
  router.get('/force-reconnect', (req: Request, res: Response) => {
    const expressReq = req as unknown as ExpressRequest
    
    // Clear credentials using session cleaner
    const session = expressReq.session as unknown as Record<string, unknown>
    Reflect.deleteProperty(session, 'sshCredentials')
    
    res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
  })

  /**
   * Re-authentication route
   */
  router.get('/reauth', (req: Request, res: Response) => {
    const expressReq = req as unknown as ExpressRequest
    debug('GET /reauth - Clearing session and forcing re-authentication')
    
    // Process reauth request with pure handler
    const { keysToRemove, redirectPath } = processReauthRequest(expressReq.session)
    
    // Clear session keys
    const session = expressReq.session as unknown as Record<string, unknown>
    keysToRemove.forEach((key: string) => {
      Reflect.deleteProperty(session, key)
    })
    
    // Redirect to login
    res.redirect(redirectPath)
  })

  return router
}