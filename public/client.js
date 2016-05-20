var client = {};
client.run = function(options) {
    options = options || {};
    window.addEventListener('load', function() {
        var socket = io.connect();
        socket.on('connect', function() {
            var term = new Terminal();
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
            });
            term.open(document.getElementById("terminal"));
            socket.on('data', function(data) {
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
    }, false);
}