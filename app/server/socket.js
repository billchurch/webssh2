'use strict'
// private
var debug = require('debug'),
  uuid  = require('node-uuid'),
  redis = require("redis").createClient(),
  debugWebSSH2 = require('debug')('WebSSH2'),
  SSH = require('ssh2').Client;
// var fs = require('fs')
// var hostkeys = JSON.parse(fs.readFileSync('./hostkeyhashes.json', 'utf8'))
var termCols, termRows
var menuData = '<a id="logBtn"><i class="fas fa-clipboard fa-fw"></i> Start Log</a>' +
  '<a id="downloadLogBtn"><i class="fas fa-download fa-fw"></i> Download Log</a>'

// public
module.exports = function socket (socket)
{
  var oSs = socket.request.session,oSsh = oSs.ssh;
  // if websocket connection arrives without an express session, kill it
  if (!socket.request.session) 
  {
    socket.emit('401 UNAUTHORIZED');
    debugWebSSH2('SOCKET: No Express Session / REJECTED');
    // 如果关闭，其他监听不可用
    // console.log("不能关闭,否则其他监听不能用");
    socket.disconnect(true);
    return
  }
  var conn = new SSH();
  socket.on('geometry', function socketOnGeometry (cols, rows) 
  {
    termCols = cols;
    termRows = rows;
  });
  conn.on('banner', function connOnBanner (data) 
  {
    // need to convert to cr/lf for proper formatting
    data = data.replace(/\r?\n/g, '\r\n')
    socket.emit('data', data.toString('utf-8'))
  });

  conn.on('ready', function connOnReady ()
  {
    if(!oSsh.redisid)
    {
      // 记录到tags库
      var szIdTmp = "ssh" + (oSsh.redisid || uuid.v4()),oTmp = {
        id:szIdTmp,
        host:oSsh.host,
        port:oSsh.port,
        username:oSs.username,
        userpassword:oSs.userpassword,
        privateKey:oSsh.privateKey};
      var szK = [oTmp.host,oTmp.port,oTmp.username].join("_");
      if(global && (!global.oNoRpt || !global.oNoRpt[szK]))
        redis.set(szIdTmp, JSON.stringify(oTmp));
    }
    //
    console.log('WebSSH2 Login: user=' + oSs.username + ' from=' + socket.handshake.address + ' host=' + oSsh.host + ' port=' + oSsh.port + ' sessionID=' + socket.request.sessionID + '/' + socket.id + ' mrhsession=' + oSsh.mrhsession + ' allowreplay=' + oSsh.allowreplay + ' term=' + oSsh.term)
    socket.emit('menu', menuData)
    socket.emit('allowreauth', oSsh.allowreauth);
    socket.emit('setTerminalOpts', oSsh.terminal);
    socket.emit('title', 'ssh://' + oSsh.host);
    if (oSsh.header.background) socket.emit('headerBackground', oSsh.header.background);
    if (oSsh.header.name) socket.emit('header', oSsh.header.name);
    socket.emit('footer', 'ssh://' + oSs.username + '@' + oSsh.host + ':' + oSsh.port);
    socket.emit('status', 'SSH CONNECTION ESTABLISHED');
    socket.emit('statusBackground', 'green');
    socket.emit('allowreplay', oSsh.allowreplay);
    conn.shell({
      term: oSsh.term,
      cols: termCols,
      rows: termRows
    }, function connShell (err, stream) {
      if (err) {
        SSHerror('EXEC ERROR' + err)
        conn.end();
        return
      }
      // poc to log commands from client
      if (oSsh.serverlog.client) var dataBuffer
      socket.on('data', function socketOnData (data) 
      {
        stream.write(data);
        // poc to log commands from client
        if (oSsh.serverlog.client) 
        {
          if (data === '\r')
          {
            console.log('serverlog.client: ' + oSs.id + '/' + socket.id + ' host: ' + oSsh.host + ' command: ' + dataBuffer);
            dataBuffer = undefined;
          } else 
          {
            dataBuffer = (dataBuffer) ? dataBuffer + data : data;
          }
        }
      })
      socket.on('control', function socketOnControl (controlData) 
      {
        switch (controlData) 
        {
          case 'replayCredentials':
            if (oSsh.allowreplay) 
            {
              stream.write(oSs.userpassword + '\n');
            }
          /* falls through */
          default:
            console.log('controlData: ' + controlData);
        }
      })
      socket.on('resize', function socketOnResize (data) 
      {
        stream.setWindow(data.rows, data.cols);
      })
      socket.on('disconnecting', function socketOnDisconnecting (reason) { debugWebSSH2('SOCKET DISCONNECTING: ' + reason) });
      socket.on('disconnect', function socketOnDisconnect (reason)
      {
        debugWebSSH2('SOCKET DISCONNECT: ' + reason);
        err = { message: reason };
        SSHerror('CLIENT SOCKET DISCONNECT', err);
        conn.end();
        // oSs.destroy()
      })
      socket.on('error', function socketOnError (err) 
      {
        SSHerror('SOCKET ERROR', err);
        conn.end();
      });

      stream.on('data', function streamOnData (data) { socket.emit('data', data.toString('utf-8')) });
      stream.on('close', function streamOnClose (code, signal) 
      {
        err = { message: ((code || signal) ? (((code) ? 'CODE: ' + code : '') + ((code && signal) ? ' ' : '') + ((signal) ? 'SIGNAL: ' + signal : '')) : undefined) }
        SSHerror('STREAM CLOSE', err);
        conn.end();
      })
      stream.stderr.on('data', function streamStderrOnData (data) 
      {
        console.log('STDERR: ' + data);
      })
    })
  });
  
  conn.on('end', function connOnEnd (err) { SSHerror('CONN END BY HOST', err) });
  conn.on('close', function connOnClose (err) { SSHerror('CONN CLOSE', err) });
  conn.on('error', function connOnError (err) { SSHerror('CONN ERROR', err) });
  conn.on('keyboard-interactive', function connOnKeyboardInteractive (name, instructions, instructionsLang, prompts, finish)
  {
    debugWebSSH2('conn.on(\'keyboard-interactive\')');
    finish([oSs.userpassword]);
  })
  
  if (oSs.username && oSsh && (oSs.userpassword || oSsh.privateKey)) 
  {
    // console.log('hostkeys: ' + hostkeys[0].[0])
    conn.connect({
      host: oSsh.host,
      port: oSsh.port,
      username: oSs.username,
      password: oSs.userpassword,
      tryKeyboard: true,
      algorithms: oSsh.algorithms,
      readyTimeout: oSsh.readyTimeout,
      keepaliveInterval: oSsh.keepaliveInterval,
      keepaliveCountMax: oSsh.keepaliveCountMax,
      privateKey: oSsh.privateKey,
      debug: debug('ssh2')
    })
  } else {
    debugWebSSH2('Attempt to connect without session.username/password or session varialbles defined, potentially previously abandoned client session. disconnecting websocket client.\r\nHandshake information: \r\n  ' + JSON.stringify(socket.handshake));
    socket.emit('ssherror', 'WEBSOCKET ERROR - Refresh the browser and try again');
    oSs.destroy();
    // 不能关闭
    // console.log("不能关闭,否则其他监听不能用");
    socket.disconnect(true);
  }

  /**
  * Error handling for various events. Outputs error to client, logs to
  * server, destroys session and disconnects socket.
  * @param {string} myFunc Function calling this function
  * @param {object} err    error object or error message
  */
  function SSHerror (myFunc, err) 
  {
    var theError;
    if (socket.request.session) 
    {
      // we just want the first error of the session to pass to the client
      oSs.error = (oSs.error) || ((err) ? err.message : undefined);
      theError = (oSs.error) ? ': ' + oSs.error : '';
      // log unsuccessful login attempt
      if (err && (err.level === 'client-authentication')) {
        console.log('WebSSH2 ' + 'error: Authentication failure'.red.bold +
          ' user=' + oSs.username.yellow.bold.underline +
          ' from=' + socket.handshake.address.yellow.bold.underline);
        socket.emit('allowreauth', oSsh.allowreauth);
        socket.emit('reauth');
      } else {
        console.log('WebSSH2 Logout: user=' + oSs.username + ' from=' + socket.handshake.address + ' host=' + oSsh.host + ' port=' + oSsh.port + ' sessionID=' + socket.request.sessionID + '/' + socket.id + ' allowreplay=' + oSsh.allowreplay + ' term=' + oSsh.term)
        if (err) {
          theError = (err) ? ': ' + err.message : '';
          console.log('WebSSH2 error' + theError)
        }
      }
      socket.emit('ssherror', 'SSH ' + myFunc + theError);
      oSs.destroy();
      socket.disconnect(true);
    } else {
      theError = (err) ? ': ' + err.message : '';
      socket.disconnect(true);
    }
    debugWebSSH2('SSHerror ' + myFunc + theError);
  }
}
