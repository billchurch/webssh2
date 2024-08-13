// server
// app/connectionHandler.js
var path = require("path")
var fs = require("fs")
var extend = require("util")._extend

function handleConnection(req, res, urlParams) {
  urlParams = urlParams || {}

  const clientPath = path.resolve(
    __dirname,
    '..',
    'node_modules',
    'webssh2_client',
    'client',
    'public'
  )

  const connectionParams = extend({}, urlParams)
  extend(connectionParams, req.query)
  extend(connectionParams, req.body || {})

  const sshCredentials = req.session.sshCredentials || {}

  const config = {
    socket: {
      url: req.protocol + '://' + req.get('host'),
      path: '/ssh/socket.io'
    },
    ssh: {
      host: urlParams.host || sshCredentials.host || '',
      port: urlParams.port || sshCredentials.port || 22,
      username: sshCredentials.username || '',
      password: sshCredentials.password || ''
    },
    autoConnect: !!req.session.sshCredentials
  }

  fs.readFile(
    path.join(clientPath, 'client.htm'),
    'utf8',
    function (err, data) {
      if (err) {
        return res.status(500).send('Error loading client file')
      }

      var modifiedHtml = data.replace(
        /(src|href)="(?!http|\/\/)/g,
        '$1="/ssh/assets/'
      )

      modifiedHtml = modifiedHtml.replace(
        'window.webssh2Config = null;',
        'window.webssh2Config = ' + JSON.stringify(config) + ';'
      )

      res.send(modifiedHtml)
    }
  )
}

module.exports = handleConnection
