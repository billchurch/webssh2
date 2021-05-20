// socket.js

// private
const debug = require('debug');
const debugWebSSH2 = require('debug')('WebSSH2');
const SSH = require('ssh2').Client;
const CIDRMatcher = require('cidr-matcher');
const validator = require('validator');
const dnsPromises = require('dns').promises;

// var fs = require('fs')
// var hostkeys = JSON.parse(fs.readFileSync('./hostkeyhashes.json', 'utf8'))
let termCols;
let termRows;

// public
module.exports = function appSocket(socket) {
  async function setupConnection() {
    // if websocket connection arrives without an express session, kill it
    if (!socket.request.session) {
      socket.emit('401 UNAUTHORIZED');
      debugWebSSH2('SOCKET: No Express Session / REJECTED');
      socket.disconnect(true);
      return;
    }

    /**
     * Error handling for various events. Outputs error to client, logs to
     * server, destroys session and disconnects socket.
     * @param {string} myFunc Function calling this function
     * @param {object} err    error object or error message
     */
    // eslint-disable-next-line complexity
    function SSHerror(myFunc, err) {
      let theError;
      if (socket.request.session) {
        // we just want the first error of the session to pass to the client
        const firstError = socket.request.session.error || (err ? err.message : undefined);
        theError = firstError ? `: ${firstError}` : '';
        // log unsuccessful login attempt
        if (err && err.level === 'client-authentication') {
          console.error(
            `WebSSH2 ${'error: Authentication failure'.red.bold} user=${
              socket.request.session.username.yellow.bold.underline
            } from=${socket.handshake.address.yellow.bold.underline}`
          );
          socket.emit('allowreauth', socket.request.session.ssh.allowreauth);
          socket.emit('reauth');
        } else {
          // eslint-disable-next-line no-console
          console.log(
            `WebSSH2 Logout: user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host} port=${socket.request.session.ssh.port} sessionID=${socket.request.sessionID}/${socket.id} allowreplay=${socket.request.session.ssh.allowreplay} term=${socket.request.session.ssh.term}`
          );
          if (err) {
            theError = err ? `: ${err.message}` : '';
            console.error(`WebSSH2 error${theError}`);
          }
        }
        socket.emit('ssherror', `SSH ${myFunc}${theError}`);
        socket.request.session.destroy();
        socket.disconnect(true);
      } else {
        theError = err ? `: ${err.message}` : '';
        socket.disconnect(true);
      }
      debugWebSSH2(`SSHerror ${myFunc}${theError}`);
    }
    // If configured, check that requsted host is in a permitted subnet
    if (
      (((socket.request.session || {}).ssh || {}).allowedSubnets || {}).length &&
      socket.request.session.ssh.allowedSubnets.length > 0
    ) {
      let ipaddress = socket.request.session.ssh.host;
      if (!validator.isIP(`${ipaddress}`)) {
        try {
          const result = await dnsPromises.lookup(socket.request.session.ssh.host);
          ipaddress = result.address;
        } catch (err) {
          console.error(
            `WebSSH2 ${`error: ${err.code} ${err.hostname}`.red.bold} user=${
              socket.request.session.username.yellow.bold.underline
            } from=${socket.handshake.address.yellow.bold.underline}`
          );
          socket.emit('ssherror', '404 HOST IP NOT FOUND');
          socket.disconnect(true);
          return;
        }
      }

      const matcher = new CIDRMatcher(socket.request.session.ssh.allowedSubnets);
      if (!matcher.contains(ipaddress)) {
        console.error(
          `WebSSH2 ${
            `error: Requested host ${ipaddress} outside configured subnets / REJECTED`.red.bold
          } user=${socket.request.session.username.yellow.bold.underline} from=${
            socket.handshake.address.yellow.bold.underline
          }`
        );
        socket.emit('ssherror', '401 UNAUTHORIZED');
        socket.disconnect(true);
        return;
      }
    }

    const conn = new SSH();
    socket.on('geometry', (cols, rows) => {
      termCols = cols;
      termRows = rows;
    });
    conn.on('banner', (data) => {
      // need to convert to cr/lf for proper formatting
      socket.emit('data', data.replace(/\r?\n/g, '\r\n').toString('utf-8'));
    });

    conn.on('ready', () => {
      debugWebSSH2(
        `WebSSH2 Login: user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host} port=${socket.request.session.ssh.port} sessionID=${socket.request.sessionID}/${socket.id} mrhsession=${socket.request.session.ssh.mrhsession} allowreplay=${socket.request.session.ssh.allowreplay} term=${socket.request.session.ssh.term}`
      );
      socket.emit('menu');
      socket.emit('allowreauth', socket.request.session.ssh.allowreauth);
      socket.emit('setTerminalOpts', socket.request.session.ssh.terminal);
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
      conn.shell(
        {
          term: socket.request.session.ssh.term,
          cols: termCols,
          rows: termRows,
        },
        (err, stream) => {
          if (err) {
            SSHerror(`EXEC ERROR${err}`);
            conn.end();
            return;
          }
          socket.on('data', (data) => {
            stream.write(data);
          });
          socket.on('control', (controlData) => {
            switch (controlData) {
              case 'replayCredentials':
                if (socket.request.session.ssh.allowreplay) {
                  stream.write(`${socket.request.session.userpassword}\n`);
                }
              /* falls through */
              default:
                debugWebSSH2(`controlData: ${controlData}`);
            }
          });
          socket.on('resize', (data) => {
            stream.setWindow(data.rows, data.cols);
          });
          socket.on('disconnecting', (reason) => {
            debugWebSSH2(`SOCKET DISCONNECTING: ${reason}`);
          });
          socket.on('disconnect', (reason) => {
            debugWebSSH2(`SOCKET DISCONNECT: ${reason}`);
            const errMsg = { message: reason };
            SSHerror('CLIENT SOCKET DISCONNECT', errMsg);
            conn.end();
            // socket.request.session.destroy()
          });
          socket.on('error', (errMsg) => {
            SSHerror('SOCKET ERROR', errMsg);
            conn.end();
          });

          stream.on('data', (data) => {
            socket.emit('data', data.toString('utf-8'));
          });
          stream.on('close', (code, signal) => {
            const errMsg = {
              message:
                code || signal
                  ? (code ? `CODE: ${code}` : '') +
                    (code && signal ? ' ' : '') +
                    (signal ? `SIGNAL: ${signal}` : '')
                  : undefined,
            };
            SSHerror('STREAM CLOSE', errMsg);
            conn.end();
          });
          stream.stderr.on('data', (data) => {
            console.error(`STDERR: ${data}`);
          });
        }
      );
    });

    conn.on('end', (err) => {
      SSHerror('CONN END BY HOST', err);
    });
    conn.on('close', (err) => {
      SSHerror('CONN CLOSE', err);
    });
    conn.on('error', (err) => {
      SSHerror('CONN ERROR', err);
    });
    conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      debugWebSSH2("conn.on('keyboard-interactive')");
      finish([socket.request.session.userpassword]);
    });
    if (
      socket.request.session.username &&
      (socket.request.session.userpassword || socket.request.session.privatekey) &&
      socket.request.session.ssh
    ) {
      // console.log('hostkeys: ' + hostkeys[0].[0])
      conn.connect({
        host: socket.request.session.ssh.host,
        port: socket.request.session.ssh.port,
        localAddress: socket.request.session.ssh.localAddress,
        localPort: socket.request.session.ssh.localPort,
        username: socket.request.session.username,
        password: socket.request.session.userpassword,
        privateKey: socket.request.session.privatekey,
        tryKeyboard: true,
        algorithms: socket.request.session.ssh.algorithms,
        readyTimeout: socket.request.session.ssh.readyTimeout,
        keepaliveInterval: socket.request.session.ssh.keepaliveInterval,
        keepaliveCountMax: socket.request.session.ssh.keepaliveCountMax,
        debug: debug('ssh2'),
      });
    } else {
      debugWebSSH2(
        `Attempt to connect without session.username/password or session varialbles defined, potentially previously abandoned client session. disconnecting websocket client.\r\nHandshake information: \r\n  ${JSON.stringify(
          socket.handshake
        )}`
      );
      socket.emit('ssherror', 'WEBSOCKET ERROR - Refresh the browser and try again');
      socket.request.session.destroy();
      socket.disconnect(true);
    }
  }
  setupConnection();
};
