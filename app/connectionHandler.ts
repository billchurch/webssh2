// server
// app/connectionHandler.ts

import { promises as fs } from 'fs'
import path from 'path'
import { createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES, DEFAULTS } from './constants.js'
import { modifyHtml } from './utils.js'
import { getClientPublicPath } from './client-path.js'
import type { WebSSH2Request, WebSSH2Response, SocketConfig } from './types/express.js'

const debug = createNamespacedDebug('connectionHandler')

/**
 * Handle reading the file and processing the response.
 * @param filePath - The path to the HTML file.
 * @param config - The configuration object to inject into the HTML.
 * @param res - The Express response object.
 */
async function handleFileRead(filePath: string, config: SocketConfig, res: WebSSH2Response): Promise<void> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath is from trusted client module, not user input
    const data = await fs.readFile(filePath, 'utf8')
    const modifiedHtml = modifyHtml(data, config)
    res.send(modifiedHtml)
  } catch {
    res.status(HTTP.INTERNAL_SERVER_ERROR).send(MESSAGES.CLIENT_FILE_ERROR)
  }
}

/**
 * Handle the connection request and send the modified client HTML.
 * @param req - The Express request object.
 * @param res - The Express response object.
 */
async function handleConnection(req: WebSSH2Request, res: WebSSH2Response): Promise<void> {
  debug('Handling connection req.path:', req.path)

  const clientPath = getClientPublicPath()

  const tempConfig: SocketConfig = {
    socket: {
      url: `${req.protocol}://${req.get('host')}`,
      path: '/ssh/socket.io',
    },
    autoConnect: req.path.startsWith('/host/'), // Automatically connect if path starts with /host/
  }

  // Session-only authentication: credentials stay server-side for security
  // The WebSocket connection will automatically use session credentials
  if (req.session.usedBasicAuth && req.session.sshCredentials) {
    // Only send non-sensitive connection info to client
    tempConfig.ssh = {
      host: req.session.sshCredentials.host,
      port: req.session.sshCredentials.port,
      // Terminal type is safe to send (not sensitive)
      ...(req.session.sshCredentials.term && { sshterm: req.session.sshCredentials.term }),
    }

    // Enable auto-connect since we have session credentials
    tempConfig.autoConnect = true

    debug('Session-only auth enabled - credentials remain server-side: %O', {
      host: tempConfig.ssh.host,
      port: tempConfig.ssh.port,
      term: tempConfig.ssh?.sshterm,
      sessionId: req.sessionID,
      hasCredentials: true,
    })
  }

  const filePath = path.join(clientPath, DEFAULTS.CLIENT_FILE)
  await handleFileRead(filePath, tempConfig, res)
}

export default handleConnection