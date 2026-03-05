import type { Request, Response } from 'express'
import { promises as fs } from 'node:fs'
import { createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES, DEFAULTS, TELNET_DEFAULTS } from './constants/index.js'
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

async function sendClient(config: unknown, res: Response, basePath?: string): Promise<void> {
  try {
    const data = await readClientTemplate()
    debug('Transforming HTML with config')
    const modifiedHtml = transformHtml(data, config, basePath)
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

interface ConnectionOptions {
  host?: string
  /** Connection mode: 'full' allows editing host/port, 'host-locked' restricts to credentials only */
  connectionMode?: 'full' | 'host-locked'
  /** Host that cannot be changed (when connectionMode is 'host-locked') */
  lockedHost?: string
  /** Port that cannot be changed (when connectionMode is 'host-locked') */
  lockedPort?: number
  /** Protocol type: 'ssh' (default) or 'telnet' */
  protocol?: 'ssh' | 'telnet'
}

export default async function handleConnection(
  req: Request & { session?: Sess; sessionID?: string },
  res: Response,
  opts?: ConnectionOptions
): Promise<void> {
  debug('Handling connection req.path:', (req as Request).path)
  const isTelnet = opts?.protocol === 'telnet'
  const socketPath = isTelnet ? TELNET_DEFAULTS.IO_PATH : DEFAULTS.IO_PATH
  const tempConfig: Record<string, unknown> = {
    socket: {
      url: `${req.protocol}://${req.get('host')}`,
      path: socketPath,
    },
    autoConnect: (req as Request).path.startsWith('/host/'),
  }

  if (isTelnet) {
    tempConfig['protocol'] = 'telnet'
  }

  // Add connection mode info for client-side LoginModal behavior
  if (opts?.connectionMode !== undefined) {
    tempConfig['connectionMode'] = opts.connectionMode
    if (opts.lockedHost !== undefined) {
      tempConfig['lockedHost'] = opts.lockedHost
    }
    if (opts.lockedPort !== undefined) {
      tempConfig['lockedPort'] = opts.lockedPort
    }
    debug('Connection mode set:', {
      mode: opts.connectionMode,
      lockedHost: opts.lockedHost,
      lockedPort: opts.lockedPort
    })
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

  const basePath = isTelnet ? '/telnet/assets/' : undefined
  await sendClient(tempConfig, res, basePath)
}
