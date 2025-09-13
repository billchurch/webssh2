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
import SSHConnection from './ssh.js'
import { getValidatedPort, validateSshTerm, maskSensitiveData } from './utils.js'

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
 * Result of SSH credential validation
 */
interface SshValidationResult {
  success: boolean
  errorType?: 'auth' | 'network' | 'timeout' | 'unknown'
  errorMessage?: string
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
async function validateSshCredentials(
  host: string,
  port: number,
  username: string,
  password: string,
  config: Config
): Promise<SshValidationResult> {
  debug(`Validating SSH credentials for ${username}@${host}:${port}`)

  const ssh = new SSHConnection(config)
  try {
    await ssh.connect({
      host,
      port,
      username,
      password,
    })

    // If we get here, authentication succeeded
    ssh.end() // Clean up the connection
    debug(`SSH validation successful for ${username}@${host}:${port}`)
    return { success: true }
  } catch (error) {
    const err = error as Error & { code?: string; level?: string }
    debug(`SSH validation failed for ${username}@${host}:${port}:`, err.message)
    debug(`Error details - code: ${err.code}, level: ${err.level}`)

    // Analyze error type
    let errorType: SshValidationResult['errorType'] = 'unknown'

    // Network/connectivity errors
    if (
      err.code === 'ENOTFOUND' ||
      err.message.includes('getaddrinfo') ||
      err.message.includes('ENOTFOUND')
    ) {
      errorType = 'network' // DNS resolution failed
    } else if (
      err.code === 'ECONNREFUSED' ||
      err.message.includes('Connection refused') ||
      err.message.includes('ECONNREFUSED')
    ) {
      errorType = 'network' // Port closed or service not running
    } else if (
      err.code === 'ETIMEDOUT' ||
      err.code === 'ECONNRESET' ||
      err.message.includes('timeout') ||
      err.message.includes('ETIMEDOUT')
    ) {
      errorType = 'timeout' // Connection timeout
    } else if (
      err.code === 'ENETUNREACH' ||
      err.message.includes('Network is unreachable') ||
      err.message.includes('ENETUNREACH')
    ) {
      errorType = 'network' // Network unreachable
    }
    // Authentication errors
    else if (
      err.level === 'client-authentication' ||
      err.message.includes('Authentication failed') ||
      err.message.includes('All configured authentication methods failed') ||
      err.message.includes('permission denied') ||
      err.message.toLowerCase().includes('password')
    ) {
      errorType = 'auth'
    }

    debug(`Determined error type: ${errorType}`)

    return {
      success: false,
      errorType,
      errorMessage: err.message,
    }
  } finally {
    // Ensure connection is always cleaned up
    ssh.end()
  }
}

export function createRoutes(config: Config): Router {
  const router = express.Router()
  const auth = createAuthMiddleware(config)

  router.get('/', (req: Request, res: Response) => {
    const r = req as ReqWithSession
    debug('router.get./: Accessed / route')
    // Also allow env vars via /ssh?env=FOO:bar
    processAuthParameters(r.query, r.session)
    void handleConnection(
      req as unknown as Request & { session?: Record<string, unknown>; sessionID?: string },
      res as Response
    )
  })

  router.get('/host/', auth, async (req: Request, res: Response): Promise<void> => {
    const r = req as ReqWithSession
    debug(`router.get.host: /ssh/host/ route`)
    processAuthParameters(r.query, r.session)
    try {
      const { host, port, term } = validateConnectionParams({
        host: config.ssh.host ?? undefined,
        port: r.query['port'] as string | undefined,
        sshterm: r.query['sshterm'] as string | undefined,
        config,
      })

      // Get credentials from session (set by auth middleware)
      const sshCredentials = r.session.sshCredentials
      if (!sshCredentials || !sshCredentials.username || !sshCredentials.password) {
        debug('Missing SSH credentials in session')
        res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
        res.status(HTTP.UNAUTHORIZED).send('Missing SSH credentials')
        return
      }

      // Validate SSH credentials immediately
      const validationResult = await validateSshCredentials(
        host,
        port,
        sshCredentials.username as string,
        sshCredentials.password as string,
        config
      )

      if (!validationResult.success) {
        debug(
          `SSH validation failed for ${sshCredentials.username}@${host}:${port}: ${validationResult.errorType} - ${validationResult.errorMessage}`
        )

        // Return appropriate status code based on error type
        switch (validationResult.errorType) {
          case 'auth':
            // Authentication failed - allow re-authentication
            res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
            res.status(HTTP.UNAUTHORIZED).send('SSH authentication failed')
            break
          case 'network':
            // Network/connectivity issue - no point in re-authenticating
            res
              .status(502)
              .send(
                `Bad Gateway: Unable to connect to SSH server at ${host}:${port} - ${validationResult.errorMessage}`
              )
            break
          case 'timeout':
            // Connection timeout
            res.status(504).send(`Gateway Timeout: SSH connection to ${host}:${port} timed out`)
            break
          case undefined:
          case 'unknown':
          default:
            // Unknown error - return 502 as it's likely a connectivity issue
            res
              .status(502)
              .send(`Bad Gateway: SSH connection failed - ${validationResult.errorMessage}`)
        }
        return
      }

      // SSH validation succeeded - proceed with normal flow
      processAuthParameters(r.query, r.session)
      const sanitizedCredentials = setupSshCredentials(r.session, {
        host,
        port,
        term,
      })
      debug('/ssh/host/ SSH validation passed - serving client: ', sanitizedCredentials)
      void handleConnection(
        req as unknown as Request & { session?: Record<string, unknown>; sessionID?: string },
        res as Response,
        { host }
      )
    } catch (err) {
      handleRouteError(err as Error, res)
    }
  })

  router.get('/host/:host', auth, async (req: Request, res: Response): Promise<void> => {
    const r = req as ReqWithSession
    debug(`router.get.host: /ssh/host/${String((req as Request).params['host'])} route`)
    try {
      const { host, port, term } = validateConnectionParams({
        hostParam: r.params['host'] as string,
        port: r.query['port'] as string | undefined,
        sshterm: r.query['sshterm'] as string | undefined,
        config,
      })

      // Get credentials from session (set by auth middleware)
      const sshCredentials = r.session.sshCredentials
      if (!sshCredentials || !sshCredentials.username || !sshCredentials.password) {
        debug('Missing SSH credentials in session')
        res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
        res.status(HTTP.UNAUTHORIZED).send('Missing SSH credentials')
        return
      }

      // Validate SSH credentials immediately
      const validationResult = await validateSshCredentials(
        host,
        port,
        sshCredentials.username as string,
        sshCredentials.password as string,
        config
      )

      if (!validationResult.success) {
        debug(
          `SSH validation failed for ${sshCredentials.username}@${host}:${port}: ${validationResult.errorType} - ${validationResult.errorMessage}`
        )

        // Return appropriate status code based on error type
        switch (validationResult.errorType) {
          case 'auth':
            // Authentication failed - allow re-authentication
            res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
            res.status(HTTP.UNAUTHORIZED).send('SSH authentication failed')
            break
          case 'network':
            // Network/connectivity issue - no point in re-authenticating
            res
              .status(502)
              .send(
                `Bad Gateway: Unable to connect to SSH server at ${host}:${port} - ${validationResult.errorMessage}`
              )
            break
          case 'timeout':
            // Connection timeout
            res.status(504).send(`Gateway Timeout: SSH connection to ${host}:${port} timed out`)
            break
          case undefined:
          case 'unknown':
          default:
            // Unknown error - return 502 as it's likely a connectivity issue
            res
              .status(502)
              .send(`Bad Gateway: SSH connection failed - ${validationResult.errorMessage}`)
        }
        return
      }

      // SSH validation succeeded - proceed with normal flow
      processAuthParameters(r.query, r.session)
      const sanitizedCredentials = setupSshCredentials(r.session, {
        host,
        port,
        term,
      })
      debug('/ssh/host/:host SSH validation passed - serving client: ', sanitizedCredentials)
      void handleConnection(
        req as unknown as Request & { session?: Record<string, unknown>; sessionID?: string },
        res as Response,
        { host }
      )
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
      if (!username || !password) {
        return void res.status(400).send('Missing required fields in body: username, password')
      }

      // Host can come from body or query params (body takes precedence)
      const host = (body['host'] ?? query['host'] ?? query['hostname']) as string | undefined
      if (!host) {
        return void res.status(400).send('Missing required field: host (in body or query params)')
      }

      // Port can come from body or query params (body takes precedence)
      // Handle both string and number types
      const portParam = (body['port'] ?? query['port']) as string | number | undefined
      const port = getValidatedPort(String(portParam))

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
      if (term) {
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
      void handleConnection(r, res, { host })
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
        // Use bracket notation to avoid object injection detection
        delete session[key as keyof typeof session]
      }
    })

    // Redirect to the main SSH page for fresh authentication
    res.redirect('/ssh')
  })

  return router
}
