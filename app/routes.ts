// server
// app/routes.ts
// Orchestration layer for HTTP route handling

import express, { type Router, type Request, type Response } from 'express'
import handleConnection from './connectionHandler.js'
import { createNamespacedDebug } from './logger.js'
import { createAuthMiddleware } from './middleware.js'
import { ConfigError, handleError } from './errors.js'
import { HTTP } from './constants.js'
import type { Config } from './types/config.js'
import {
  processAuthParameters,
  setupSshCredentials,
  validateConnectionParams,
  type AuthSession,
} from './auth/auth-utils.js'
import { validateSshCredentials } from './connection/index.js'

// Import pure functions from decomposed modules
import {
  createSshValidationErrorResponse,
  createRouteErrorMessage,
  type ErrorResponse
} from './routes/route-error-handler.js'

import {
  extractHost,
  extractPort,
  extractTerm,
  validatePostCredentials,
  validateSessionCredentials,
  createSanitizedCredentials
} from './routes/route-validators.js'

import {
  createSessionCredentials,
  createPostAuthSession,
  getReauthClearKeys,
  getAuthRelatedKeys
} from './routes/session-handler.js'

const debug = createNamespacedDebug('routes')

// Use AuthSession from auth-utils
type Sess = AuthSession

type ReqWithSession = Request & {
  session: Sess
  query: Record<string, unknown>
  params: Record<string, string>
  body: Record<string, unknown>
  headers: Record<string, unknown>
}

/**
 * Handle route errors with proper HTTP responses
 * Side effect: sends HTTP response
 */
function handleRouteError(
  err: Error,
  res: { status: (c: number) => { send: (b: unknown) => void; json: (b: unknown) => void } }
): void {
  const error = new ConfigError(createRouteErrorMessage(err))
  handleError(
    error,
    res as unknown as {
      status: (c: number) => { send: (b: unknown) => void; json: (b: unknown) => void }
    }
  )
}

/**
 * Apply error response to HTTP response object
 * Side effect: sends HTTP response
 */
function sendErrorResponse(res: Response, errorResponse: ErrorResponse): void {
  // Set headers if provided
  if (errorResponse.headers != null) {
    Object.entries(errorResponse.headers).forEach(([key, value]) => {
      res.setHeader(key, value)
    })
  }
  
  res.status(errorResponse.status).send(errorResponse.message)
}

/**
 * Common SSH route handler logic
 * Handles validation, authentication, and connection setup
 */
async function handleSshRoute(
  req: ReqWithSession,
  res: Response,
  connectionParams: {
    host: string
    port: number
    term: string | null
  },
  config: Config
): Promise<void> {
  // Validate session has credentials
  if (!validateSessionCredentials(req.session.sshCredentials)) {
    debug('Missing SSH credentials in session')
    res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
    res.status(HTTP.UNAUTHORIZED).send('Missing SSH credentials')
    return
  }

  const { username, password } = req.session.sshCredentials as { username: string; password: string }

  // Validate SSH credentials immediately
  const validationResult = await validateSshCredentials(
    connectionParams.host,
    connectionParams.port,
    username,
    password,
    config
  )

  if (validationResult.success === false) {
    debug(
      `SSH validation failed for ${username}@${connectionParams.host}:${connectionParams.port}: ${validationResult.errorType} - ${validationResult.errorMessage}`
    )

    // Get error response data using pure function
    const errorResponse = createSshValidationErrorResponse(
      validationResult,
      connectionParams.host,
      connectionParams.port
    )

    sendErrorResponse(res, errorResponse)
    return
  }

  // SSH validation succeeded - proceed with normal flow
  processAuthParameters(req.query, req.session)
  const sanitizedCredentials = setupSshCredentials(req.session, connectionParams)
  debug('SSH validation passed - serving client: ', sanitizedCredentials)
  
  handleConnection(
    req as unknown as Request & { session?: Record<string, unknown>; sessionID?: string },
    res,
    { host: connectionParams.host }
  ).catch((error) => {
    debug('Error handling connection:', error)
    handleRouteError(error as Error, res)
  })
}

export function createRoutes(config: Config): Router {
  const router = express.Router()
  const auth = createAuthMiddleware(config)

  // Root route - uses default config
  router.get('/', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug('router.get./: Accessed / route')
    processAuthParameters(r.query, r.session)
    
    handleConnection(
      req as unknown as Request & { session?: Record<string, unknown>; sessionID?: string },
      res
    ).catch((error) => {
      debug('Error handling connection:', error)
      handleRouteError(error as Error, res)
    })
  })

  // Host route without parameter - uses config default
  router.get('/host/', auth, async (req: Request, res: Response): Promise<void> => {
    const r = req as ReqWithSession
    debug(`router.get.host: /ssh/host/ route`)
    processAuthParameters(r.query, r.session)
    
    try {
      const portParam = r.query['port'] as string | undefined
      const portNumber = portParam != null && portParam !== '' ? parseInt(portParam, 10) : undefined
      
      const { host, port, term } = validateConnectionParams({
        host: config.ssh.host ?? undefined,
        port: portNumber,
        sshterm: r.query['sshterm'] as string | undefined,
        config,
      })

      await handleSshRoute(r, res, { host, port, term }, config)
    } catch (err) {
      handleRouteError(err as Error, res)
    }
  })

  // Host route with parameter
  router.get('/host/:host', auth, async (req: Request, res: Response): Promise<void> => {
    const r = req as ReqWithSession
    debug(`router.get.host: /ssh/host/${String((req).params['host'])} route`)
    
    try {
      const portParam = r.query['port'] as string | undefined
      const portNumber = portParam != null && portParam !== '' ? parseInt(portParam, 10) : undefined
      
      const { host, port, term } = validateConnectionParams({
        hostParam: r.params['host'] as string,
        port: portNumber,
        sshterm: r.query['sshterm'] as string | undefined,
        config,
      })

      await handleSshRoute(r, res, { host, port, term }, config)
    } catch (err) {
      handleRouteError(err as Error, res)
    }
  })

  // Clean POST authentication route for SSO/API integration
  router.post('/', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug('router.post./: POST /ssh route for SSO authentication')

    try {
      const body = req.body as Record<string, unknown>
      const query = r.query as Record<string, unknown>

      // Validate credentials using pure function
      const credentialValidation = validatePostCredentials(body)
      if (!credentialValidation.valid) {
        res.status(400).send(`Missing required fields in body: ${credentialValidation.error}`)
        return
      }

      // Extract host using pure function
      const host = extractHost(body, query, config)
      if (host == null) {
        res.status(400).send('Missing required field: host (in body or query params)')
        return
      }

      // Extract port and term using pure functions
      const port = extractPort(body, query)
      const term = extractTerm(body, query)

      // Create session credentials using pure function
      const sessionCredentials = createSessionCredentials(
        host,
        port,
        credentialValidation.username ?? '',
        credentialValidation.password ?? '',
        term
      )

      // Apply to session using pure function pattern
      const sessionUpdates = createPostAuthSession(sessionCredentials)
      Object.assign(r.session, sessionUpdates)

      // Create sanitized log data using pure function
      const sanitized = createSanitizedCredentials(host, port, credentialValidation.username ?? '')
      debug('POST /ssh - Credentials stored in session:', sanitized)
      debug(
        'POST /ssh - Source: body=%o, query=%o',
        { host: body['host'], port: body['port'], sshterm: body['sshterm'] },
        { host: query['host'] ?? query['hostname'], port: query['port'], sshterm: query['sshterm'] }
      )

      // Serve the client page
      handleConnection(r, res, { host }).catch((error) => {
        debug('Error handling connection:', error)
        handleRouteError(error as Error, res)
      })
    } catch (err) {
      handleRouteError(err as Error, res)
    }
  })

  // Clear credentials route
  router.get('/clear-credentials', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    delete (r.session as Record<string, unknown>)['sshCredentials']
    res.status(HTTP.OK).send(HTTP.CREDENTIALS_CLEARED)
  })

  // Force reconnect route
  router.get('/force-reconnect', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    delete (r.session as Record<string, unknown>)['sshCredentials']
    res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED)
  })

  // Re-authentication route
  router.get('/reauth', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug('router.get.reauth: Clearing session credentials and forcing re-authentication')

    // Clear standard auth keys using pure function
    const clearKeys = getReauthClearKeys()
    const session = r.session as Record<string, unknown>
    
    clearKeys.forEach(key => {
      Reflect.deleteProperty(session, key)
    })

    // Clear additional auth-related keys using pure function
    const authRelatedKeys = getAuthRelatedKeys(Object.keys(session))
    authRelatedKeys.forEach(key => {
      Reflect.deleteProperty(session, key)
    })

    // Redirect to the main SSH page for fresh authentication
    res.redirect('/ssh')
  })

  return router
}