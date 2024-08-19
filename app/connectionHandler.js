// server
// app/connectionHandler.js
const createDebug = require('debug')
const path = require('path')
const fs = require('fs')
const extend = require('util')._extend
const debug = createDebug('webssh2:connectionHandler')

function handleConnection(req, res, urlParams) {
  debug('Handling connection')
  urlParams = urlParams || {}

  const clientPath = path.resolve(
    __dirname,
    '..',
    'node_modules',
    'webssh2_client',
    'client',
    'public'
  )

  const tempConfig = {
    socket: {
      url: req.protocol + '://' + req.get('host'),
      path: '/ssh/socket.io'
    },
    autoConnect: false // Default to false
  }

  // Check if the current route is /host/:host
  if (req.path.startsWith('/ssh/host/')) {
    tempConfig.autoConnect = true
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
        'window.webssh2Config = ' + JSON.stringify(tempConfig) + ';'
      )

      res.send(modifiedHtml)
    }
  )
}

module.exports = handleConnection
