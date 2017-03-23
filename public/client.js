var sessionLog,
    sessionLogEnable = false,
    sessionFooter,
    logDate;
document.getElementById('downloadLog').style.display = 'none';
var terminalContainer = document.getElementById('terminal-container'),
    term = new Terminal({
        cursorBlink: true
    }),
    socket,
    termid;
term.open(terminalContainer);
term.fit();

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

function replayCredentials() {
    socket.emit('control', 'replayCredentials');
    console.log("replaying credentials");
    return false;
}

function startLog() {
    if (sessionLogEnable == true) {
        sessionLogEnable = false;
        document.getElementById('startLog').innerHTML = '<a class="startLog" href="javascript:void(0);" onclick="startLog();">Start Log</a>';
        console.log("stopping log, " + sessionLogEnable);
        currentDate = new Date();
        sessionLog = sessionLog + "\r\n\r\nLog End for " + sessionFooter + ": " + currentDate.getFullYear() + "/" + (currentDate.getMonth() + 1) + "/" + currentDate.getDate() + " @ " + currentDate.getHours() + ":" + currentDate.getMinutes() + ":" + currentDate.getSeconds() + "\r\n";
        logDate = currentDate;
        return false;
    } else {
        sessionLogEnable = true;
        document.getElementById('startLog').innerHTML = '<a class="startLog" href="javascript:void(0)" onclick="startLog();">Logging - STOP LOG</a>';
        document.getElementById('downloadLog').style.display = 'inline';
        console.log("starting log, " + sessionLogEnable);
        currentDate = new Date();
        sessionLog = "Log Start for " + sessionFooter + ": " + currentDate.getFullYear() + "/" + (currentDate.getMonth() + 1) + "/" + currentDate.getDate() + " @ " + currentDate.getHours() + ":" + currentDate.getMinutes() + ":" + currentDate.getSeconds() + "\r\n\r\n";
        logDate = currentDate;
        return false;
    }
}

function downloadLog() {
    myFile = "WebSSH2-" + logDate.getFullYear() + (logDate.getMonth() + 1) + logDate.getDate() + "_" + logDate.getHours() + logDate.getMinutes() + logDate.getSeconds() + ".log";
    var blob = new Blob([sessionLog], {
        type: 'text/plain'
    });
    if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, myFile);
    } else {
        var elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = myFile;
        document.body.appendChild(elem);
        elem.click();
        document.body.removeChild(elem);
    }
}
socket.on('connect', function() {
    socket.emit('geometry', term.cols, term.rows);
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
        sessionFooter = data;
        document.getElementById('footer').innerHTML = data;
    }).on('statusBackground', function(data) {
        document.getElementById('status').style.backgroundColor = data;
    }).on('allowreplay', function(data) {
        if (data == 'true') {
            console.log('allowreplay: ' + data);
            document.getElementById('credentials').style.display = 'inline';
        } else {
            document.getElementById('credentials').style.display = 'none';
        }
    }).on('data', function(data) {
        term.write(data);
        if (sessionLogEnable) {
            sessionLog = sessionLog + data;
        }
    }).on('disconnect', function() {
        document.getElementById('status').style.backgroundColor = 'red';
        document.getElementById('status').innerHTML = 'WEBSOCKET SERVER DISCONNECTED' + err;
        socket.io.reconnection(false);
    }).on('error', function(err) {
        document.getElementById('status').style.backgroundColor = 'red';
        document.getElementById('status').innerHTML = 'ERROR ' + err;
    });
});