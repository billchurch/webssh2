// server
// app/connectionHandler.js

const fs = require("fs")
const path = require("path")
const { createNamespacedDebug } = require("./logger")

const debug = createNamespacedDebug("connectionHandler")
/**
 * Modify the HTML content by replacing certain placeholders with dynamic values.
 * @param {string} html - The original HTML content.
 * @param {Object} config - The configuration object to inject into the HTML.
 * @returns {string} - The modified HTML content.
 */
function modifyHtml(html, config) {
  const modifiedHtml = html.replace(
    /(src|href)="(?!http|\/\/)/g,
    '$1="/ssh/assets/'
  )

  return modifiedHtml.replace(
    "window.webssh2Config = null;",
    `window.webssh2Config = ${JSON.stringify(config)};`
  )
}

/**
 * Handle reading the file and processing the response.
 * @param {string} filePath - The path to the HTML file.
 * @param {Object} config - The configuration object to inject into the HTML.
 * @param {Object} res - The Express response object.
 */
function handleFileRead(filePath, config, res) {
  // eslint-disable-next-line consistent-return
  fs.readFile(filePath, "utf8", function(err, data) {
    if (err) {
      return res.status(500).send("Error loading client file")
    }

    const modifiedHtml = modifyHtml(data, config)
    res.send(modifiedHtml)
  })
}

/**
 * Handle the connection request and send the modified client HTML.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
function handleConnection(req, res) {
  debug("Handling connection req.path:", req.path)

  const clientPath = path.resolve(
    __dirname,
    "..",
    "node_modules",
    "webssh2_client",
    "client",
    "public"
  )

  const tempConfig = {
    socket: {
      url: `${req.protocol}://${req.get("host")}`,
      path: "/ssh/socket.io"
    },
    autoConnect: req.path.startsWith("/host/") // Automatically connect if path starts with /host/
  }

  const filePath = path.join(clientPath, "client.htm")
  handleFileRead(filePath, tempConfig, res)
}

module.exports = handleConnection
