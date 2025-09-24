import type { Request, Response } from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES, DEFAULTS } from './constants.js'
import { modifyHtml } from './utils.js'
import { getClientPublicPath } from './client-path.js'
import type { AuthSession } from './auth/auth-utils.js'

const debug = createNamespacedDebug('connectionHandler')

type Sess = AuthSession

/**
 * Check if session has any type of credentials (Basic Auth or POST)
 */
function hasSessionCredentials(session: Sess): boolean {
  return Boolean(
    session.sshCredentials != null &&
    (session.usedBasicAuth === true || session.authMethod === 'POST')
  )
}

async function sendClient(filePath: string, config: unknown, res: Response): Promise<void> {
  try {
    // File path is from internal client module resolution, not user input
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const data = await fs.readFile(filePath, 'utf8')
    const modifiedHtml = modifyHtml(data, config)
    res.send(modifiedHtml)
  } catch {
    res.status(HTTP.INTERNAL_SERVER_ERROR).send(MESSAGES.CLIENT_FILE_ERROR)
  }
}

export default async function handleConnection(
  req: Request & { session?: Sess; sessionID?: string },
  res: Response,
  _opts?: { host?: string }
): Promise<void> {
  debug('Handling connection req.path:', (req as Request).path)
  const clientPath = getClientPublicPath()

  const tempConfig: Record<string, unknown> = {
    socket: {
      url: `${req.protocol}://${req.get('host')}`,
      path: DEFAULTS.IO_PATH,
    },
    autoConnect: (req as Request).path.startsWith('/host/'),
  }

  const s = req.session
  if (hasSessionCredentials(s) && s.sshCredentials != null) {
    const creds = s.sshCredentials
    tempConfig['ssh'] = {
      host: creds.host,
      port: creds.port,
      ...(creds.term != null && creds.term !== '' && { sshterm: creds.term }),
    }
    tempConfig['autoConnect'] = true

    const authType = s.usedBasicAuth === true ? 'Basic Auth' : (s.authMethod ?? 'Unknown')
    debug('Session-only auth enabled - credentials remain server-side: %O', {
      authType,
      host: creds.host,
      port: creds.port,
      term: creds.term,
      sessionId: req.sessionID,
      hasCredentials: true,
    })
  }

  const filePath = path.join(clientPath, DEFAULTS.CLIENT_FILE)
  await sendClient(filePath, tempConfig, res)
}
