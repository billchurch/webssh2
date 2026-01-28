// app/routes/adapters/express-adapter.ts
// Express adapter for pure route handlers

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { Result } from '../../types/result.js'
import type { Config } from '../../types/config.js'
import type { AuthSession } from '../../auth/auth-utils.js'
import { createNamespacedDebug } from '../../logger.js'
import { HTTP } from '../../constants/index.js'
import type { SshRouteResponse, SshRouteRequest } from '../handlers/ssh-handler.js'
import { renderErrorPage } from '../templates/error-page.js'

const debug = createNamespacedDebug('routes:adapter')

export type RouteProcessor<T, R> = (request: T, config: Config) => Result<R> | Promise<Result<R>>

type ExpressRequest = Request & {
  session: AuthSession & Record<string, unknown>
}

/**
 * Convert Express request to route request
 */
export const extractRouteRequest = (req: ExpressRequest): SshRouteRequest => {
  return {
    session: req.session,
    query: req.query as Record<string, unknown>,
    params: req.params,
    body: req.body as Record<string, unknown>,
    headers: req.headers as Record<string, unknown>
  }
}

/**
 * Check if an error response data object has the expected structure
 */
const isErrorResponseData = (
  data: unknown
): data is { error: string; message: string; host: string; port: number } => {
  if (data === null || typeof data !== 'object') {
    return false
  }
  const obj = data as Record<string, unknown>
  return (
    typeof obj['error'] === 'string' &&
    typeof obj['message'] === 'string' &&
    typeof obj['host'] === 'string' &&
    typeof obj['port'] === 'number'
  )
}

/**
 * Check if request prefers HTML response based on Accept header
 */
const prefersHtml = (req: Request): boolean => {
  const acceptHeader = req.get('accept') ?? ''
  // Check if text/html appears before application/json in Accept header
  // or if text/html is present and application/json is not
  const htmlIndex = acceptHeader.indexOf('text/html')
  const jsonIndex = acceptHeader.indexOf('application/json')

  if (htmlIndex === -1) {
    return false
  }
  if (jsonIndex === -1) {
    return true
  }
  return htmlIndex < jsonIndex
}

/**
 * Apply route response to Express response
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

  // Check if this is an error response that should be rendered as HTML for browsers
  const isErrorStatus = response.status >= 400
  const req = res.req
  const acceptsHtml = prefersHtml(req)

  if (isErrorStatus && acceptsHtml && isErrorResponseData(response.data)) {
    // Browser request with error - return HTML error page
    const showRetry = response.status === HTTP.UNAUTHORIZED
    const html = renderErrorPage({
      title: response.data.error,
      message: response.data.message,
      host: response.data.host,
      port: response.data.port,
      showRetry
    })
    res.type('text/html').send(html)
    return
  }

  // For 502 Bad Gateway without proper error data, send plain text for compatibility
  if (response.status === HTTP.BAD_GATEWAY && !isErrorResponseData(response.data)) {
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

/**
 * Error handler implementation
 */
function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  debug('Route error:', err)

  // Check if response already sent
  if (res.headersSent) {
    return
  }

  // Map error types to HTTP responses
  let statusCode: number
  if (err.name === 'ValidationError') {
    statusCode = 400
  } else if (err.name === 'AuthenticationError') {
    statusCode = HTTP.UNAUTHORIZED
  } else if (err.name === 'ConfigError') {
    statusCode = HTTP.INTERNAL_SERVER_ERROR
  } else {
    statusCode = HTTP.INTERNAL_SERVER_ERROR
  }

  res.status(statusCode).json({
    error: err.message,
    type: err.name
  })
}

/**
 * Create error response handler
 */
export const createErrorHandler = (): ((
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void) => {
  return errorHandler
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