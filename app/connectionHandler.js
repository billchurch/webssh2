// server
// app/connectionHandler.js
const createDebug = require("debug")
const path = require("path")
const fs = require("fs")

const debug = createDebug("webssh2:connectionHandler")

function handleConnection(req, res) {
  debug("Handling connection")

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
    autoConnect: false // Default to false
  }

  // Check if the current route is /host/:host
  debug("handleConnection req.path:", req.path)
  if (req.path.startsWith("/host/")) {
    tempConfig.autoConnect = true
  }

  fs.readFile(path.join(clientPath, "client.htm"), "utf8", function(err, data) {
    if (err) {
      return res.status(500).send("Error loading client file")
    }

    let modifiedHtml = data.replace(
      /(src|href)="(?!http|\/\/)/g,
      '$1="/ssh/assets/'
    )

    modifiedHtml = modifiedHtml.replace(
      "window.webssh2Config = null;",
      `window.webssh2Config = ${JSON.stringify(tempConfig)};`
    )

    res.send(modifiedHtml)
    // Explicitly return to satisfy the linter
  })
}

module.exports = handleConnection
