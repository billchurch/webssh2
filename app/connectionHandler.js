// server
// app/connectionHandler.js

import { promises as fs } from 'fs'
import path from 'path'
import { createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES, DEFAULTS } from './constants.js'
import { modifyHtml } from './utils.js'
import { getClientPublicPath } from './client-path.js'
const debug = createNamespacedDebug('connectionHandler')

/**
 * Handle reading the file and processing the response.
 * @param {string} filePath - The path to the HTML file.
 * @param {Object} config - The configuration object to inject into the HTML.
 * @param {Object} res - The Express response object.
 */
async function handleFileRead(filePath, config, res) {
  try {
    const data = await fs.readFile(filePath, 'utf8')
    const modifiedHtml = modifyHtml(data, config)
    res.send(modifiedHtml)
  } catch {
    res.status(HTTP.INTERNAL_SERVER_ERROR).send(MESSAGES.CLIENT_FILE_ERROR)
  }
}

/**
 * Handle the connection request and send the modified client HTML.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
async function handleConnection(req, res) {
  debug('Handling connection req.path:', req.path)

  const clientPath = getClientPublicPath()

  const tempConfig = {
    socket: {
      url: `${req.protocol}://${req.get('host')}`,
      path: '/ssh/socket.io',
    },
    autoConnect: req.path.startsWith('/host/'), // Automatically connect if path starts with /host/
  }

  const filePath = path.join(clientPath, DEFAULTS.CLIENT_FILE)
  await handleFileRead(filePath, tempConfig, res)
}

export default handleConnection
