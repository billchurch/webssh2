import type { Request, Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import { createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES, DEFAULTS } from './constants.js'
import { modifyHtml } from './utils.js'
import { getClientPublicPath } from './client-path.js'

const debug = createNamespacedDebug('connectionHandler')

type Sess = {
  usedBasicAuth?: boolean
  sshCredentials?: { host?: string; port?: number; term?: string | null }
  [k: string]: unknown
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
      path: '/ssh/socket.io',
    },
    autoConnect: (req as Request).path?.startsWith('/host/'),
  }

  const s = (req.session || {}) as Sess
  if (s.usedBasicAuth && s.sshCredentials) {
    tempConfig['ssh'] = {
      host: s.sshCredentials.host,
      port: s.sshCredentials.port,
      ...(s.sshCredentials.term && { sshterm: s.sshCredentials.term }),
    }
    tempConfig['autoConnect'] = true
    const sshCfg = tempConfig['ssh'] as
      | { host?: string; port?: number; sshterm?: string }
      | undefined
    debug('Session-only auth enabled - credentials remain server-side: %O', {
      host: sshCfg?.host,
      port: sshCfg?.port,
      term: sshCfg?.sshterm,
      sessionId: req.sessionID,
      hasCredentials: true,
    })
  }

  const filePath = path.join(clientPath, DEFAULTS.CLIENT_FILE)
  await sendClient(filePath, tempConfig, res)
}
