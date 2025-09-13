// app/routes/handlers/connection.handler.ts
// Handler for SSH connection routes

import type { Request, Response } from 'express'
import { createNamespacedDebug } from '../../logger.js'
import { modifyHtml } from '../../utils.js'
import type { Config } from '../../types/config.js'

const debug = createNamespacedDebug('routes:connection')

type ConnectionRequest = Request & {
  session?: Record<string, unknown>
  sessionID?: string
}

/**
 * Handle SSH connection request
 * @param req - Express request
 * @param res - Express response
 */
export function handleConnection(
  req: ConnectionRequest,
  res: Response
): void {
  const host = req.headers.host ?? 'localhost'
  const config = (req.app.locals as { config: Config }).config
  
  debug(`Connection request for host: ${host}`)
  
  try {
    // modifyHtml expects 2 arguments: html string and config
    // Need to get the base HTML first
    const baseHtml = '<html><body>WebSSH2</body></html>' // TODO: Load actual HTML template
    const html = modifyHtml(baseHtml, config)
    res.send(html)
  } catch (error) {
    debug('Error modifying HTML:', error)
    res.status(500).send('Internal Server Error')
  }
}

/**
 * Create connection params from request
 * @param req - Express request
 * @returns Connection parameters
 * @pure
 */
export function extractConnectionParams(req: Request): {
  host?: string
  port?: string
  sshterm?: string
} {
  const query = req.query as Record<string, unknown>
  const params = req.params as Record<string, string>
  
  const result: {
    host?: string
    port?: string
    sshterm?: string
  } = {}
  
  if (params['host'] != null) {
    result.host = params['host']
  }
  if (query['port'] != null) {
    result.port = query['port'] as string
  }
  if (query['sshterm'] != null) {
    result.sshterm = query['sshterm'] as string
  }
  
  return result
}