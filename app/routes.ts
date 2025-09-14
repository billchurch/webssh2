// server
// app/routes.ts

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
import { getValidatedPort, validateSshTerm, maskSensitiveData } from './utils.js'
import { validateSshCredentials } from './connection/index.js'

const debug = createNamespacedDebug('routes')

// Use AuthSession from auth-utils
type Sess = AuthSession

function handleRouteError(
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

/**
 * Handles SSH validation failure responses based on error type
 * Pure function that returns response data without side effects
 */
function createSshValidationErrorResponse(validationResult: {
  errorType?: string
  errorMessage?: string
}, host: string, port: number): {
  status: number
  headers?: Record<string, string>
  message: string
} {
  switch (validationResult.errorType) {
    case 'auth':
      // Authentication failed - allow re-authentication
      return {
        status: HTTP.UNAUTHORIZED,
        headers: { [HTTP.AUTHENTICATE]: HTTP.REALM },
        message: 'SSH authentication failed'
      }
    case 'network':
      // Network/connectivity issue - no point in re-authenticating
      return {
        status: 502,
        message: `Bad Gateway: Unable to connect to SSH server at ${host}:${port} - ${validationResult.errorMessage}`
      }
    case 'timeout':
      // Connection timeout
      return {
        status: 504,
        message: `Gateway Timeout: SSH connection to ${host}:${port} timed out`
      }
    case undefined:
    case 'unknown':
    default:
      // Unknown error - return 502 as it's likely a connectivity issue
      return {
        status: 502,
        message: `Bad Gateway: SSH connection failed - ${validationResult.errorMessage}`
      }
  }
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
  // Get credentials from session (set by auth middleware)
  const sshCredentials = req.session.sshCredentials
  if (sshCredentials?.username == null || sshCredentials.username === '' || 
      sshCredentials.password == null || sshCredentials.password === '') {
    debug('Missing SSH credentials in session')
    res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
    res.status(HTTP.UNAUTHORIZED).send('Missing SSH credentials')
    return
  }

  // Validate SSH credentials immediately
  const validationResult = await validateSshCredentials(
    connectionParams.host,
    connectionParams.port,
    sshCredentials.username,
    sshCredentials.password,
    config
  )

  if (validationResult.success === false) {
    debug(
      `SSH validation failed for ${sshCredentials.username}@${connectionParams.host}:${connectionParams.port}: ${validationResult.errorType} - ${validationResult.errorMessage}`
    )

    // Get error response data
    const errorResponse = createSshValidationErrorResponse(
      validationResult,
      connectionParams.host,
      connectionParams.port
    )

    // Set headers if provided
    if (errorResponse.headers != null) {
      Object.entries(errorResponse.headers).forEach(([key, value]) => {
        res.setHeader(key, value)
      })
    }

    res.status(errorResponse.status).send(errorResponse.message)
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


/**
 * Validate SSH credentials by attempting a connection
 * Returns detailed result including error type for proper HTTP status codes
 *
 * IMPORTANT: HTTP Basic Auth Behavior
 *
 * When invalid credentials are provided:
 * 1. URL WITHOUT embedded credentials (http://host/path) - Browser will show auth dialog on 401, allowing re-authentication
 * 2. URL WITH embedded credentials (http://user:pass@host/path) - Browser will NEVER prompt for new credentials, even on 401
 *
 * This is standard HTTP Basic Auth behavior. URLs with embedded credentials take absolute precedence
 * over HTTP auth dialogs. Users must manually remove bad credentials from the URL to re-authenticate.
 */

export function createRoutes(config: Config): Router {
  const router = express.Router()
  const auth = createAuthMiddleware(config)

  router.get('/', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug('router.get./: Accessed / route')
    // Also allow env vars via /ssh?env=FOO:bar
    processAuthParameters(r.query, r.session)
    handleConnection(
      req as unknown as Request & { session?: Record<string, unknown>; sessionID?: string },
      res
    ).catch((error) => {
      debug('Error handling connection:', error)
      handleRouteError(error as Error, res)
    })
  })

  router.get('/host/', auth, async (req: Request, res: Response): Promise<void> => {
    const r = req as ReqWithSession
    debug(`router.get.host: /ssh/host/ route`)
    processAuthParameters(r.query, r.session)
    try {
      // Convert port to number early if it exists
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

  router.get('/host/:host', auth, async (req: Request, res: Response): Promise<void> => {
    const r = req as ReqWithSession
    debug(`router.get.host: /ssh/host/${String((req).params['host'])} route`)
    try {
      // Convert port to number early if it exists
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
  // Separated from Basic Auth to avoid session credential conflicts
  router.post('/', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug('router.post./: POST /ssh route for SSO authentication')

    try {
      const body = req.body as Record<string, unknown>
      const query = r.query as Record<string, unknown>

      // Username and password are required in body
      const { username, password } = body
      if (username == null || username === '' || password == null || password === '') {
        res.status(400).send('Missing required fields in body: username, password')
        return
      }

      // Host can come from body or query params (body takes precedence)
      const host = (body['host'] ?? query['host'] ?? query['hostname']) as string | undefined
      if (host == null || host === '') {
        res.status(400).send('Missing required field: host (in body or query params)')
        return
      }

      // Port can come from body or query params (body takes precedence)
      // Convert to number early if it exists
      const portParam = (body['port'] ?? query['port']) as string | number | undefined
      const portNumber = portParam != null ? 
        (typeof portParam === 'number' ? portParam : parseInt(portParam, 10)) : 
        undefined
      const port = getValidatedPort(portNumber)

      // SSH term can come from body or query params (body takes precedence)
      const sshterm = (body['sshterm'] ?? query['sshterm']) as string | undefined
      const term = validateSshTerm(sshterm)

      // Store credentials in session for this POST auth
      r.session.authMethod = 'POST'
      r.session.sshCredentials = {
        host,
        port,
        username: username as string,
        password: password as string,
      }
      if (term != null && term !== '') {
        r.session.sshCredentials.term = term
      }

      const sanitized = maskSensitiveData({
        host,
        port,
        username: username as string,
        password: '********',
      })
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

  router.get('/reauth', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug('router.get.reauth: Clearing session credentials and forcing re-authentication')

    // Clear all SSH-related session data
    delete (r.session as Record<string, unknown>)['sshCredentials']
    delete (r.session as Record<string, unknown>)['usedBasicAuth']
    delete (r.session as Record<string, unknown>)['authMethod']

    // Clear any other auth-related session data
    const session = r.session as Record<string, unknown>
    Object.keys(session).forEach((key) => {
      if (key.startsWith('ssh') || key.includes('auth') || key.includes('cred')) {
        // Use Reflect.deleteProperty to safely delete properties
        Reflect.deleteProperty(session, key)
      }
    })

    // Redirect to the main SSH page for fresh authentication
    res.redirect('/ssh')
  })

  return router
}
