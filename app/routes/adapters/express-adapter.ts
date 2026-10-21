// app/routes/adapters/express-adapter.ts
// Express adapter for pure route handlers

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { Result } from '../../types/result.js'
import type { Config } from '../../types/config.js'
import type { AuthSession } from '../../auth/auth-utils.js'
import { createNamespacedDebug, logError } from '../../logger.js'
import type { LogContext } from '../../logging/log-context.js'
import { HTTP } from '../../constants/index.js'
import type { SshRouteResponse, SshRouteRequest } from '../handlers/ssh-handler.js'
import { createSafeKey, safeSet } from '../../utils/safe-property-access.js'

const debug = createNamespacedDebug('routes:adapter')

export type RouteProcessor<T, R> = (request: T, config: Config) => Result<R> | Promise<Result<R>>

type ExpressRequest = Request & {
  session: AuthSession & Record<string, unknown>
}

/**
 * Convert ParamsDictionary to Record<string, string>
 * Express params can be string | string[] but our routes only use string params
 */
const normalizeParams = (params: Record<string, string | string[] | undefined>): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    // Keys from Object.entries are safe for property access
    const safeKey = createSafeKey(key)
    if (typeof value === 'string') {
      safeSet(result, safeKey, value)
    } else if (Array.isArray(value)) {
      // Take first value if array (shouldn't happen in our routes)
      const firstValue = value[0]
      if (typeof firstValue === 'string') {
        safeSet(result, safeKey, firstValue)
      }
    }
  }
  return result
}

/**
 * Convert Express request to route request
 */
export const extractRouteRequest = (req: ExpressRequest): SshRouteRequest => {
  return {
    session: req.session,
    query: req.query,
    params: normalizeParams(req.params),
    body: req.body as Record<string, unknown>,
    headers: req.headers
  }
}

/**
 * Apply route response to Express response.
 * Note: Error responses are now always JSON - HTML error pages have been replaced
 * with client-side error modals via the 'connection-error' WebSocket event.
 */
export const applyRouteResponse = (
  response: SshRouteResponse,
  res: Response
): void => {
  // Apply headers if present
  if (response.headers != null) {
    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value)
    }
  }

  // Handle redirect
  if (response.redirect != null && response.redirect !== '') {
    res.redirect(response.redirect)
    return
  }

  // Send response
  res.status(response.status)

  // For 502 Bad Gateway, send plain text for compatibility
  if (response.status === HTTP.BAD_GATEWAY) {
    res.send('Bad Gateway')
    return
  }

  if (response.data == null) {
    res.end()
  } else {
    res.json(response.data)
  }
}

/**
 * Create Express route handler from pure processor
 */
export const createRouteHandler = <T, R extends SshRouteResponse>(
  processor: RouteProcessor<T, R>,
  config: Config,
  extractRequest: (req: ExpressRequest) => T = extractRouteRequest as (req: ExpressRequest) => T
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = extractRequest(req as unknown as ExpressRequest)
      const result = await processor(request, config)
      
      if (result.ok) {
        applyRouteResponse(result.value, res)
      } else {
        // Handle processor errors
        debug('Route processor error:', result.error)
        res.status(400).json({
          error: result.error.message
        })
      }
    } catch (error) {
      // Pass unexpected errors to Express error handler
      next(error)
    }
  }
}

/**
 * Create async route wrapper with error handling
 */
export const asyncRouteHandler = (
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res)).catch(next)
  }
}

/**
 * Session update middleware
 */
export const createSessionUpdater = (
  updates: (req: ExpressRequest) => Partial<AuthSession>
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const expressReq = req as unknown as ExpressRequest
    const sessionUpdates = updates(expressReq)
    Object.assign(expressReq.session, sessionUpdates)
    next()
  }
}

/**
 * Session cleaner middleware
 */
export const createSessionCleaner = (
  keysToRemove: string[] | ((req: ExpressRequest) => string[])
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const expressReq = req as unknown as ExpressRequest
    const keys = typeof keysToRemove === 'function' 
      ? keysToRemove(expressReq)
      : keysToRemove
    
    const session = expressReq.session as unknown as Record<string, unknown>
    for (const key of keys) {
      Reflect.deleteProperty(session, key)
    }
    
    next()
  }
}

export type RouteErrorLogger = (message: string, error: Error, context?: Partial<LogContext>) => void

export interface ErrorHandlerDependencies {
  readonly logError?: RouteErrorLogger
}

/**
 * Map an error to its HTTP status code
 */
const getRouteErrorStatus = (err: Error): number => {
  if (err.name === 'ValidationError') {
    return HTTP.BAD_REQUEST
  }
  if (err.name === 'AuthenticationError') {
    return HTTP.UNAUTHORIZED
  }
  return HTTP.INTERNAL_SERVER_ERROR
}

/**
 * Whether Express's router raised the error while decoding a route
 * parameter (for example /host/%ZZ), before any route code ran.
 * The router sets status 400 on that URIError.
 */
const isRouterDecodeError = (err: Error): boolean =>
  err instanceof URIError && (err as URIError & { status?: unknown }).status === HTTP.BAD_REQUEST

/**
 * Create error response handler.
 * ValidationError and AuthenticationError keep their user-facing message.
 * Every other error gets a generic 500 body, and the full error is logged
 * on the server only.
 */
export const createErrorHandler = (
  deps: ErrorHandlerDependencies = {}
): ((
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void) => {
  const logRouteError = deps.logError ?? logError

  return (err: Error, req: Request, res: Response, next: NextFunction): void => {
    debug('Route error:', err)

    // Leave malformed request paths to Express, which answers 400 as it did
    // before this handler was registered after the routes
    if (isRouterDecodeError(err)) {
      next(err)
      return
    }

    const statusCode = getRouteErrorStatus(err)

    if (statusCode === HTTP.INTERNAL_SERVER_ERROR) {
      logRouteError('Unhandled route error', err, {
        reason: err.name,
        ...(req.ip === undefined ? {} : { clientIp: req.ip })
      })
    }

    // Check if response already sent
    if (res.headersSent) {
      return
    }

    if (statusCode === HTTP.INTERNAL_SERVER_ERROR) {
      res.status(statusCode).json({
        error: HTTP.INTERNAL_ERROR_MESSAGE,
        type: HTTP.INTERNAL_ERROR_TYPE
      })
      return
    }

    res.status(statusCode).json({
      error: err.message,
      type: err.name
    })
  }
}

/**
 * Validation middleware factory
 */
export const createValidator = <T>(
  validator: (data: unknown) => Result<T>,
  source: 'body' | 'query' | 'params' = 'body'
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    let data: unknown
    switch (source) {
      case 'body':
        data = req.body
        break
      case 'query':
        data = req.query
        break
      case 'params':
        data = req.params
        break
    }
    const result = validator(data)
    
    if (result.ok === false) {
      res.status(400).json({
        error: result.error.message,
        field: source
      })
      return
    }
    
    // Attach validated data to request
    (req as Request & { validated?: T }).validated = result.value
    next()
  }
}