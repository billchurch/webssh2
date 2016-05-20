var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var path = require('path');
var basicAuth = require('basic-auth');
var term = require('term.js');
var ssh = require('ssh2');
var readConfig = require('read-config'),
    config = readConfig(__dirname + '/config.json');

console.log(config);

var isPortTaken = function(port, fn) {
  var net = require('net')
  var tester = net.createServer()
  .once('error', function (err) {
    if (err.code != 'EADDRINUSE') return fn(err)
    fn(null, true)
  })
  .once('listening', function() {
    tester.once('close', function() { fn(null, false) })
    .close()
  })
  .listen(port)
}

function checkParams(arr) {
    return function(req, res, next) {
        // Make sure each param listed in arr is present in req.query
        var missing_params = [];
        for (var i = 0; i < arr.length; i++) {
            if (!eval("req.query." + arr[i])) {
                missing_params.push(arr[i]);
            }
        }
        if (missing_params.length == 0) {
            next();
        } else {
            next(JSON.stringify({
                "error": "query error",
                "message": "Parameter(s) missing: " + missing_params.join(",")
            }));
        }
    }
}

server.listen({
    host: config.listen.ip,
    port: config.listen.port
}).on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        config.listen.port++;
        console.log('Address in use, retrying on port ' + config.listen.port);
        setTimeout(function () {
            server.listen(config.listen.port);
        }, 250);
    }
});

app.use(express.static(__dirname + '/public')).use(term.middleware()).use(function(req, res, next) {
    var myAuth = basicAuth(req);
    if (myAuth === undefined) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH"');
        res.end('Username and password required for web SSH service.');
    } else {
        config.user.name = myAuth['name'];
        config.user.password = myAuth['pass'];
        next();
    }
}).get('/', checkParams(["host"]), function(req, res) {
    res.sendFile(path.join(__dirname + '/public/client.htm'))
    config.ssh.host = req.query.host
    if (typeof req.query.port !== 'undefined' && req.query.port !== null){ config.host.port = req.query.port;}
    if (typeof req.query.header !== 'undefined' && req.query.header !== null){ config.header.text = req.query.header;}
    if (typeof req.query.headerBackground !== 'undefined' && req.query.headerBackground !== null){ config.header.background = req.query.headerBackground;}
    // debug // console.log('varibles passwd: ' + username + '/' + host + '/' + port);
});

io.on('connection', function(socket) {
    var conn = new ssh();
    conn.on('banner', function(msg, lng) {
        socket.emit('data', msg);
    }).on('ready', function() {
        socket.emit('title', 'ssh://' + config.ssh.host);
        socket.emit('headerBackground', config.header.background);
        socket.emit('header', config.header.text);
        socket.emit('footer', 'ssh://' + config.user.name + '@' + config.ssh.host + ':' + config.ssh.port);
        socket.emit('status', 'SSH CONNECTION ESTABLISHED');
        socket.emit('statusBackground', 'green');
        conn.shell(function(err, stream) {
            if (err) return socket.emit('status', 'SSH EXEC ERROR: ' + err.message).emit('statusBackground', 'red');
            socket.on('data', function(data) {
                stream.write(data);
            });
            stream.on('data', function(d) {
                socket.emit('data', d.toString('binary'));
            }).on('close', function() {
                conn.end();
            });
        });
    }).on('end', function() {
        socket.emit('status', 'SSH CONNECTION CLOSED BY HOST');
        socket.emit('statusBackground', 'red');
    }).on('close', function() {
        socket.emit('status', 'SSH CONNECTION CLOSED');
        socket.emit('statusBackground', 'red');
    }).on('error', function(error) {
        socket.emit('status', 'SSH CONNECTION ERROR - ' + error)
        socket.emit('statusBackground', 'red');
    }).connect({
        host: config.ssh.host,
        port: config.ssh.port,
        username: config.user.name,
        password: config.user.password,
// some cisco routers need the these cipher strings
        algorithms: {
            'cipher': ['aes128-cbc', '3des-cbc', 'aes256-cbc'],
            'hmac': ['hmac-sha1', 'hmac-sha1-96', 'hmac-md5-96']
        }
    });
});