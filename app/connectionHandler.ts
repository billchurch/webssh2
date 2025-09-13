import type { Request, Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
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
  return !!(
    session.sshCredentials &&
    (session.usedBasicAuth === true || session.authMethod === 'POST')
  )
}

async function sendClient(filePath: string, config: unknown, res: Response): Promise<void> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath from trusted client module
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

  const s = (req as Request & { session: Sess }).session
  if (hasSessionCredentials(s)) {
    tempConfig['ssh'] = {
      host: s.sshCredentials!.host,
      port: s.sshCredentials!.port,
      ...(s.sshCredentials!.term && { sshterm: s.sshCredentials!.term }),
    }
    tempConfig['autoConnect'] = true

    const authType = s.usedBasicAuth ? 'Basic Auth' : (s.authMethod ?? 'Unknown')
    debug('Session-only auth enabled - credentials remain server-side: %O', {
      authType,
      host: s.sshCredentials!.host,
      port: s.sshCredentials!.port,
      term: s.sshCredentials!.term,
      sessionId: req.sessionID,
      hasCredentials: true,
    })
  }

  const filePath = path.join(clientPath, DEFAULTS.CLIENT_FILE)
  await sendClient(filePath, tempConfig, res)
}
