// server
// app/connectionHandler.js
var path = require('path');
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
    res.locals.webssh2Config = {
      socket: {
        url: req.protocol + '://' + req.get('host'),
        path: '/ssh/socket.io'
      }
    };
  
    // You can process connectionParams here or pass them to the client
  
    // Serve the client HTML
    res.sendFile(path.join(clientPath, 'client.htm'));
}

module.exports = handleConnection;