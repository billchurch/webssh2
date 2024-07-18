// server
// app/connectionHandler.js
var path = require('path');
var fs = require('fs');
var extend = require('util')._extend;

function handleConnection(req, res, urlParams) {
    urlParams = urlParams || {};
    
    // The path to the client directory of the webssh2 module.
    var clientPath = path.resolve(__dirname, '..', 'node_modules', 'webssh2_client', 'client', 'public');

    // Combine URL parameters, query parameters, and form data
    var connectionParams = extend({}, urlParams);
    extend(connectionParams, req.query);
    extend(connectionParams, req.body || {});
  
    // Inject configuration
    var config = {
      socket: {
        url: req.protocol + '://' + req.get('host'),
        path: '/ssh/socket.io'
      },
      ssh: {
        host: connectionParams.host || '',
        port: connectionParams.port || 22
      }
    };
  
    // Read the client.htm file
    fs.readFile(path.join(clientPath, 'client.htm'), 'utf8', function(err, data) {
      if (err) {
        return res.status(500).send('Error loading client file');
      }
      
      // Replace relative paths with the correct path
      var modifiedHtml = data.replace(/(src|href)="(?!http|\/\/)/g, '$1="/ssh/assets/');
      
      // Inject the configuration into the HTML
      modifiedHtml = modifiedHtml.replace('window.webssh2Config = null;', 'window.webssh2Config = ' + JSON.stringify(config) + ';');
      
      // Send the modified HTML
      res.send(modifiedHtml);
    });
}

module.exports = handleConnection;