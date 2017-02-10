/*
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch - April 2016
 * 
 */ 

var express = require('express');
var app = express();
var cookieParser = require('cookie-parser')
var server = require('http').Server(app);
var io = require('socket.io')(server);
var path = require('path');

var basicAuth = require('basic-auth');
var ssh = require('ssh2');
var readConfig = require('read-config'),
    config = readConfig(__dirname + '/config.json');

function logErrors(err, req, res, next) {
  console.error(err.stack);
  next(err);
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

app.use(express.static(__dirname + '/public')).use(function(req, res, next) {
    var myAuth = basicAuth(req);
    if (myAuth === undefined) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH"');
        res.end('Username and password required for web SSH service.');
    } else if (myAuth.name == "") {
        res.statusCode = 401
        res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH"');
        res.end('Username and password required for web SSH service.');
    } else {
        config.user.name = myAuth.name;
        config.user.password = myAuth.pass;
        next();
    }
}).use(cookieParser()).get('/ssh/host/:host?', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/client.htm'));
    config.ssh.host = req.params.host;
    if (typeof req.query.port !== 'undefined' && req.query.port !== null){ config.host.port = req.query.port;}
    if (typeof req.query.header !== 'undefined' && req.query.header !== null){ config.header.text = req.query.header;}
    if (typeof req.query.headerBackground !== 'undefined' && req.query.headerBackground !== null){ config.header.background = req.query.headerBackground;}
    console.log ('webssh2 Login: user=' + config.user.name + ' from=' + req.ip + ' host=' + config.ssh.host + ' port=' + config.ssh.port + ' sessionID=' + req.headers['sessionid'] + ' allowreplay=' + req.headers['allowreplay']);
    console.log ('Headers: ' + JSON.stringify(req.headers));
    config.options.allowreplay = req.headers['allowreplay'];

}).use('/style',express.static(__dirname + '/public')).use('/src',express.static(__dirname + '/node_modules/xterm/dist')).use('/addons',express.static(__dirname + '/node_modules/xterm/dist/addons'));

io.on('connection', function(socket) {
    var conn = new ssh();
    conn.on('banner', function(d) {
        //need to convert to cr/lf for proper formatting
        d = d.replace(/\r?\n/g, "\r\n");
        socket.emit('data', d.toString('binary'));
    }).on('ready', function() {
        socket.emit('title', 'ssh://' + config.ssh.host);
        socket.emit('headerBackground', config.header.background);
        socket.emit('header', config.header.text);
        socket.emit('footer', 'ssh://' + config.user.name + '@' + config.ssh.host + ':' + config.ssh.port);
        socket.emit('status', 'SSH CONNECTION ESTABLISHED');
        socket.emit('statusBackground', 'green');
        socket.emit('allowreplay', config.options.allowreplay)
        conn.shell(function(err, stream) {
            if (err) return socket.emit('status', 'SSH EXEC ERROR: ' + err.message).emit('statusBackground', 'red');
            socket.on('data', function(data) {
                stream.write(data);
            });
            socket.on('control', function(controlData) {
                switch(controlData) {
                    case 'replayCredentials':
                        stream.write(config.user.password + '\n');
                    default:
                        console.log ('controlData: '+ controlData);
                };
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
        socket.emit('status', 'SSH CONNECTION ERROR - ' + error);
        socket.emit('statusBackground', 'red');
    }).on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
        console.log('Connection :: keyboard-interactive');
        finish([config.user.password]);
    }).connect({
        host: config.ssh.host,
        port: config.ssh.port,
        username: config.user.name,
        password: config.user.password,
        tryKeyboard: true,
// some cisco routers need the these cipher strings
        algorithms: {
            'cipher': ['aes128-cbc', '3des-cbc', 'aes256-cbc'],
            'hmac': ['hmac-sha1', 'hmac-sha1-96', 'hmac-md5-96']
        }
    });
});
