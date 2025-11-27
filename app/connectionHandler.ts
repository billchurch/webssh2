import type { Request, Response } from 'express'
import { promises as fs } from 'node:fs'
import { createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES, DEFAULTS } from './constants/index.js'
import { transformHtml } from './utils/html-transformer.js'
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

async function sendClient(config: unknown, res: Response): Promise<void> {
  try {
    const data = await readClientTemplate()
    debug('Transforming HTML with config')
    const modifiedHtml = transformHtml(data, config)
    res.send(modifiedHtml)
  } catch {
    res.status(HTTP.INTERNAL_SERVER_ERROR).send(MESSAGES.CLIENT_FILE_ERROR)
  }
}

let cachedClientTemplate: string | null = null

async function readClientTemplate(): Promise<string> {
  if (cachedClientTemplate != null) {
    return cachedClientTemplate
  }

  for (const reader of CLIENT_TEMPLATE_READERS) {
    try {
      const template = await reader()
      cachedClientTemplate = template
      return template
    } catch (error) {
      debug('Client template candidate failed: %s', (error as { message?: string }).message ?? 'unknown error')
    }
  }

  throw new Error('Client template not found in expected locations')
}

type TemplateReader = () => Promise<string>

const readFromProjectRoot: TemplateReader = () =>
  fs.readFile('node_modules/webssh2_client/client/public/client.htm', 'utf8')

const readFromParentRoot: TemplateReader = () =>
  fs.readFile('../node_modules/webssh2_client/client/public/client.htm', 'utf8')

const readFromGrandParentRoot: TemplateReader = () =>
  fs.readFile('../../node_modules/webssh2_client/client/public/client.htm', 'utf8')

const CLIENT_TEMPLATE_READERS: readonly TemplateReader[] = [
  readFromProjectRoot,
  readFromParentRoot,
  readFromGrandParentRoot
]

export default async function handleConnection(
  req: Request & { session?: Sess; sessionID?: string },
  res: Response,
  _opts?: { host?: string }
): Promise<void> {
  debug('Handling connection req.path:', (req as Request).path)
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

  await sendClient(tempConfig, res)
}
