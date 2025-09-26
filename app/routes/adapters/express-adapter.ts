// app/routes/adapters/express-adapter.ts
// Express adapter for pure route handlers

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { Result } from '../../types/result.js'
import type { Config } from '../../types/config.js'
import type { AuthSession } from '../../auth/auth-utils.js'
import { createNamespacedDebug } from '../../logger.js'
import { HTTP } from '../../constants.js'
import type { SshRouteResponse, SshRouteRequest } from '../handlers/ssh-handler.js'

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
 * Apply route response to Express response
 */
export const applyRouteResponse = (
  response: SshRouteResponse,
  res: Response
): void => {
  // Apply headers if present
  if (response.headers != null) {
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value)
    })
  }

  // Handle redirect
  if (response.redirect != null && response.redirect !== '') {
    res.redirect(response.redirect)
    return
  }

  // Send response
  res.status(response.status)
  
  if (response.data != null) {
    res.json(response.data)
  } else {
    res.end()
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
  return (req: Request, res: Response, next: NextFunction): void => {
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
  return (req: Request, res: Response, next: NextFunction): void => {
    const expressReq = req as unknown as ExpressRequest
    const keys = typeof keysToRemove === 'function' 
      ? keysToRemove(expressReq)
      : keysToRemove
    
    const session = expressReq.session as unknown as Record<string, unknown>
    keys.forEach(key => {
      Reflect.deleteProperty(session, key)
    })
    
    next()
  }
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
  return (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
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