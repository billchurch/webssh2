// app/utils/response-helpers.ts
// HTTP response helper utilities

import type { Response } from 'express'
import { HTTP } from '../constants.js'

/**
 * Send unauthorized response with authentication header
 */
export function sendUnauthorized(res: Response, message = 'Authentication required'): void {
  res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM)
  res.status(HTTP.UNAUTHORIZED).send(message)
}

/**
 * Send bad request response
 */
export function sendBadRequest(res: Response, message: string): void {
  res.status(400).send(message)
}

/**
 * Send gateway timeout response
 */
export function sendGatewayTimeout(res: Response, host: string, port: number): void {
  res.status(504).send(`Gateway Timeout: SSH connection to ${host}:${port} timed out`)
}

/**
 * Send bad gateway response
 */
export function sendBadGateway(res: Response, host: string, port: number, error: string): void {
  res.status(502).send(`Bad Gateway: SSH connection to ${host}:${port} failed - ${error}`)
}

/**
 * Send success response
 */
export function sendSuccess(res: Response, message: string): void {
  res.status(HTTP.OK).send(message)
}

/**
 * Send JSON response
 */
export function sendJson<T>(res: Response, data: T, status = 200): void {
  res.status(status).json(data)
}