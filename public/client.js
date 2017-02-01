var terminalContainer = document.getElementById('terminal-container'),
    term = new Terminal({
	cursorBlink: true
    }),
    socket,
    termid;
term.open(terminalContainer);
term.fit();
var cols = term.cols,
    rows = term.rows;
if (document.location.pathname) {
    var parts = document.location.pathname.split('/'),
        base = parts.slice(0, parts.length - 1).join('/') + '/',
        resource = base.substring(1) + 'socket.io';
    socket = io.connect(null, {
        resource: resource
    });
} else {
    socket = io.connect();
}
var credentialReplay = document.getElementById('credentials')
credentialReplay.onclick = replayCredentials;

function replayCredentials() {
    socket.emit('control', 'replayCredentials');
    //term.writeln('sending credentials');
    return true;
}
socket.emit('create', term.cols, term.rows, function(err, data) {
    if (err) return self._destroy();
    self.pty = data.pty;
    self.id = data.id;
    termid = self.id;
    term.emit('open tab', self);
});
socket.on('connect', function() {
    term.on('data', function(data) {
        socket.emit('data', data);
    });
    socket.on('title', function(data) {
        document.title = data;
    }).on('status', function(data) {
        document.getElementById('status').innerHTML = data;
    }).on('headerBackground', function(data) {
        document.getElementById('header').style.backgroundColor = data;
    }).on('header', function(data) {
        document.getElementById('header').innerHTML = data;
    }).on('footer', function(data) {
        document.getElementById('footer').innerHTML = data;
    }).on('statusBackground', function(data) {
        document.getElementById('status').style.backgroundColor = data;
    }).on('allowreplay', function(data) {
        console.log ('allowreplay: ' + data);
        if (data == 'true') {
            document.getElementById('credentials').style.display = 'inline';
            console.log ('display: block');
        } else {
            document.getElementById('credentials').style.display = 'none';
	    console.log ('display: none');
        }
    }).on('data', function(data) {
        term.write(data);
    }).on('disconnect', function() {
        document.getElementById('status').style.backgroundColor = 'red';
        document.getElementById('status').innerHTML = 'WEBSOCKET SERVER DISCONNECTED';
        socket.io.reconnection(false);
    }).on('error', function(err) {
        document.getElementById('status').style.backgroundColor = 'red';
        document.getElementById('status').innerHTML = 'ERROR ' + err;
    });
});
