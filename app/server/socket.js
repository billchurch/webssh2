/* eslint-disable complexity */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }],
   no-console: ["error", { allow: ["warn", "error"] }] */
/* jshint esversion: 6, asi: true, node: true */
// socket.js

// private
const debug = require('debug');
const SSH = require('ssh2').Client;
const CIDRMatcher = require('cidr-matcher');
const validator = require('validator');
const dnsPromises = require('dns').promises;
const util = require('util');
const { webssh2debug, auditLog, logError } = require('./logging');

/**
 * parse conn errors
 * @param {object} socket Socket object
 * @param {object} err    Error object
 */
function connError(socket, err) {
  let msg = util.inspect(err);
  const { session } = socket.request;
  if (err?.level === 'client-authentication') {
    msg = `Authentication failure user=${session.username} from=${socket.handshake.address}`;
    socket.emit('allowreauth', session.ssh.allowreauth);
    socket.emit('reauth');
  }
  if (err?.code === 'ENOTFOUND') {
    msg = `Host not found: ${err.hostname}`;
  }
  if (err?.level === 'client-timeout') {
    msg = `Connection Timeout: ${session.ssh.host}`;
  }
  logError(socket, 'CONN ERROR', msg);
}

/**
 * check ssh host is in allowed subnet
 * @param {object} socket Socket information
 */
async function checkSubnet(socket) {
  let ipaddress = socket.request.session.ssh.host;
  if (!validator.isIP(`${ipaddress}`)) {
    try {
      const result = await dnsPromises.lookup(socket.request.session.ssh.host);
      ipaddress = result.address;
    } catch (err) {
      logError(
        socket,
        'CHECK SUBNET',
        `${err.code}: ${err.hostname} user=${socket.request.session.username} from=${socket.handshake.address}`
      );
      socket.emit('ssherror', '404 HOST IP NOT FOUND');
      socket.disconnect(true);
      return;
    }
  }

  const matcher = new CIDRMatcher(socket.request.session.ssh.allowedSubnets);
  if (!matcher.contains(ipaddress)) {
    logError(
      socket,
      'CHECK SUBNET',
      `Requested host ${ipaddress} outside configured subnets / REJECTED user=${socket.request.session.username} from=${socket.handshake.address}`
    );
    socket.emit('ssherror', '401 UNAUTHORIZED');
    socket.disconnect(true);
  }
}

/**
 * @type {Map<string, {
    conn: SSH;
    isLogin: () => boolean;
    changeSocket: (newSocket: any) => void;
}>}
 */
const sshMap = new Map();

/**
 * 
 * @param {import ("socket.io-client").Socket} socket 
 * @returns 
 */
function setupNewConnection(socket) {
  const conn = new SSH();
  let login = false;
  let stream;

  conn.on('banner', (data) => {
    // need to convert to cr/lf for proper formatting
    socket.emit('data', data.replace(/\r?\n/g, '\r\n').toString('utf-8'));
  });

  function handshake() {
    socket.emit('setTerminalOpts', socket.request.session.ssh.terminal);
    socket.emit('menu');
    socket.emit('allowreauth', socket.request.session.ssh.allowreauth);
    socket.emit('title', `ssh://${socket.request.session.ssh.host}`);
    if (socket.request.session.ssh.header.background)
      socket.emit('headerBackground', socket.request.session.ssh.header.background);
    if (socket.request.session.ssh.header.name)
      socket.emit('header', socket.request.session.ssh.header.name);
    socket.emit(
      'footer',
      `ssh://${socket.request.session.username}@${socket.request.session.ssh.host}:${socket.request.session.ssh.port}`
    );

    socket.emit('status', 'SSH CONNECTION ESTABLISHED');
    socket.emit('statusBackground', 'green');
    socket.emit('allowreplay', socket.request.session.ssh.allowreplay);

    socket.on('control', (controlData) => {
      if (!stream) return;
      if (controlData === 'replayCredentials' && socket.request.session.ssh.allowreplay) {
        stream.write(`${socket.request.session.userpassword}\n`);
      }
      if (controlData === 'reauth' && socket.request.session.username && login === true) {
        auditLog(
          socket,
          `LOGOUT user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host}:${socket.request.session.ssh.port}`
        );
        login = false;
        socket.disconnect(true);
        conn.end()
      }
      webssh2debug(socket, `SOCKET CONTROL: ${controlData}`);
    });
    socket.on('resize', (data) => {
      if (!stream) return;
      stream.setWindow(data.rows, data.cols);
      webssh2debug(socket, `SOCKET RESIZE: ${JSON.stringify([data.rows, data.cols])}`);
    });
    socket.on('data', (data) => {
      if (!stream) return;
      stream.write(data);
    });
  }
  conn.on('handshake', handshake);

  conn.on('ready', () => {
    webssh2debug(
      socket,
      `CONN READY: LOGIN: user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host} port=${socket.request.session.ssh.port} allowreplay=${socket.request.session.ssh.allowreplay} term=${socket.request.session.ssh.term}`
    );
    auditLog(
      socket,
      `LOGIN user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host}:${socket.request.session.ssh.port}`
    );
    login = true;
    const { term, cols, rows } = socket.request.session.ssh;
    conn.shell({ term, cols, rows }, (err, s) => {
      if (err) {
        logError(socket, `EXEC ERROR`, err);
        conn.end();
        socket.disconnect(true);
        return;
      }
      socket.once('disconnect', (reason) => {
        webssh2debug(socket, `CLIENT SOCKET DISCONNECT: ${util.inspect(reason)}`);
      });
      socket.on('error', (errMsg) => {
        if (!socket) return;
        webssh2debug(socket, `SOCKET ERROR: ${errMsg}`);
        logError(socket, 'SOCKET ERROR', errMsg);
        conn.end();
        login = false;
        socket.disconnect(true);
      });
      stream = s;
      stream.on('data', (data) => {
        if (!socket) return;
        socket.emit('data', data.toString('utf-8'));
      });
      stream.on('close', (code, signal) => {
        if (!socket) return;
        webssh2debug(socket, `STREAM CLOSE: ${util.inspect([code, signal])}`);
        if (socket.request.session?.username) {
          auditLog(
            socket,
            `LOGOUT user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host}:${socket.request.session.ssh.port}`
          );
        }
        if (code !== 0 && typeof code !== 'undefined')
          logError(socket, 'STREAM CLOSE', util.inspect({ message: [code, signal] }));
        socket.disconnect(true);
      });
      stream.stderr.on('data', (data) => {
        console.error(`STDERR: ${data}`);
      });
    });
  });

  conn.on('end', (err) => {
    if (err) logError(socket, 'CONN END BY HOST', err);
    webssh2debug(socket, 'CONN END BY HOST');
    socket.disconnect(true);
  });
  conn.on('close', (err) => {
    if (err) logError(socket, 'CONN CLOSE', err);
    webssh2debug(socket, 'CONN CLOSE');
    socket.disconnect(true);
  });
  conn.on('error', (err) => connError(socket, err));

  conn.on('keyboard-interactive', (_name, _instructions, _instructionsLang, _prompts, finish) => {
    webssh2debug(socket, 'CONN keyboard-interactive');
    finish([socket.request.session.userpassword]);
  });

  return {
    conn, isLogin: () => login, changeSocket: (newSocket) => {
      if (!socket.disconnected) {
        socket.disconnect();
      }
      socket = newSocket;

      // to display after resuming connection
      if (login && stream) {
        handshake();
        stream.write("\n");
      } 
    }
  };
}

// public
module.exports = function appSocket(socket) {
  let login = false;

  socket.once('disconnecting', (reason) => {
    webssh2debug(socket, `SOCKET DISCONNECTING: ${reason}`);
    if (login === true) {
      auditLog(
        socket,
        `LOGOUT user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host}:${socket.request.session.ssh.port}`
      );
      login = false;
    }
  });

  // if websocket connection arrives without an express session, kill it
  if (!socket.request.session) {
    socket.emit('401 UNAUTHORIZED');
    webssh2debug(socket, 'SOCKET: No Express Session / REJECTED');
    socket.disconnect(true);
    return;
  }

  if (
    !socket.request.session.username ||
    !(socket.request.session.userpassword || socket.request.session.privateKey) ||
    !socket.request.session.ssh
  ) {
    webssh2debug(
      socket,
      `CONN CONNECT: Attempt to connect without session.username/password or session varialbles defined, potentially previously abandoned client session. disconnecting websocket client.\r\nHandshake information: \r\n  ${util.inspect(
        socket.handshake
      )}`
    );
    socket.emit('ssherror', 'WEBSOCKET ERROR - Refresh the browser and try again');
    socket.request.session.destroy();
    socket.disconnect(true);
    return;
  }

  // If configured, check that requsted host is in a permitted subnet
  if (socket.request.session?.ssh?.allowedSubnets?.length > 0) {
    checkSubnet(socket);
  }

  const mapKey = [socket.request.sessionID, socket.request.session.username, socket.request.session.ssh.host].join('/')
  var connMap = sshMap.get(mapKey);
  if (!connMap) {
    connMap = setupNewConnection(socket);
    sshMap.set(mapKey, connMap);
  } else {
    connMap.changeSocket(socket);
  }
  const { conn, isLogin } = connMap;


  const { ssh } = socket.request.session;
  ssh.username = socket.request.session.username;
  ssh.password = socket.request.session.userpassword;
  ssh.tryKeyboard = true;
  ssh.debug = debug('ssh2');
  if (!isLogin())
    conn.connect(ssh);

};
