const debugWebSSH2 = require('debug')('WebSSH2');
const debug = require('debug');
const { Client } = require('ssh2');
const tls = require('tls');
const { Runloop } = require('@runloop/api-client');
const { convertPKCS8toPKCS1 } = require('./util');

// Function to create a TLS connection (simulating ProxyCommand with openssl s_client)
function tlsProxyConnect(hostname, callback) {
  const tlsSocket = tls.connect(
    {
      host: 'ssh.runloop.pro', // Proxy server address
      port: 443, // Proxy port (HTTPS over TLS)
      servername: hostname, // Target hostname, acts like -servername in openssl
      checkServerIdentity: () => undefined, // Disable hostname validation
    },
    () => {
      console.log('TLS connection established');
      callback(null, tlsSocket); // Return the established socket
    },
  );

  tlsSocket.on('error', (err) => {
    console.error('TLS connection error:', err);
    callback(err);
  });
}

// Main function to establish the SSH connection over the TLS proxy
async function establishConnection(conn, socket, targetDevbox, bearerToken, environment) {
  const host = `https://api.runloop.${environment === 'prod' ? 'ai' : 'pro'}`;
  const runloop = new Runloop({
    baseURL: host,
    // This is gotten by just inspecting the browser cookies on platform.runloop.pro
    bearerToken,
  });
  try {
    console.log(`Creating SSH key for devbox ${targetDevbox}`);
    const sshKeyCreateResp = await runloop.devboxes.createSSHKey(targetDevbox);

    const hostname = sshKeyCreateResp.url;

    // SS KEY
    // Environment
    // Get ssh config information
    tlsProxyConnect(hostname, (err, tlsSocket) => {
      if (err) {
        console.error('Error during proxy connection:', err);
        return;
      }

      // Now use ssh2 to connect over the TLS socket
      conn
        .on('ready', () => {
          console.log('SSH Client ready');
        })
        .on('error', (error) => {
          console.error('SSH Connection error:', error);
        })
        .connect({
          sock: tlsSocket, // Pass the TLS socket as the connection
          username: 'user', // Replace with the correct SSH username
          privateKey: convertPKCS8toPKCS1(sshKeyCreateResp.ssh_private_key), // Replace with the path to your private key
          hostHash: 'md5', // Optional: Match host keys by hash
          strictHostKeyChecking: false, // Disable strict host key checking

          //   algorithms: socket.request.session.ssh.algorithms,
          readyTimeout: 10000,
          keepaliveInterval: 120000,
          keepaliveCountMax: 10,
          debug: debug('ssh2'),
        });
    });
  } catch (e) {
    console.error(e);
    socket.disconnect(true);
  }
}

// public
module.exports = function appSocket(socket) {
  const connection = new Client();
  let termCols;
  let termRows;
  async function setupConnection() {
    // TODO AUTH?
    // if websocket connection arrives without an express session, kill it
    // if (!socket.request.session) {
    //   socket.emit('401 UNAUTHORIZED');
    //   debugWebSSH2('SOCKET: No Express Session / REJECTED');
    //   socket.disconnect(true);
    //   return;
    // }

    socket.on('geometry', (cols, rows) => {
      termCols = cols;
      termRows = rows;
    });
    connection.on('banner', (data) => {
      // need to convert to cr/lf for proper formatting
      socket.emit('data', data.replace(/\r?\n/g, '\r\n').toString('utf-8'));
    });

    connection.on('ready', () => {
      // debugWebSSH2(
      //   `WebSSH2 Login: user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host} port=${socket.request.session.ssh.port} sessionID=${socket.request.sessionID}/${socket.id} mrhsession=${socket.request.session.ssh.mrhsession} allowreplay=${socket.request.session.ssh.allowreplay} term=${socket.request.session.ssh.term}`,
      // );
      connection.shell(
        {
          term: 'xterm-color',
          cols: termCols,
          rows: termRows,
        },
        (err, stream) => {
          if (err) {
            // SSHerror(`EXEC ERROR${err}`);
            socket.disconnect(true);
            connection.end();
            return;
          }
          socket.on('data', (data) => {
            stream.write(data);
          });
          socket.on('control', (controlData) => {
            // Todo probably remove
            switch (controlData) {
              // case 'replayCredentials':
              //   if (socket.request.session.ssh.allowreplay) {
              //     stream.write(`${socket.request.session.userpassword}\n`);
              //   }
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
            // const errMsg = { message: reason };
            // SSHerror('CLIENT SOCKET DISCONNECT', errMsg);
            socket.disconnect(true);
            connection.end();
            // socket.request.session.destroy()
          });
          socket.on('error', (errMsg) => {
            // SSHerror('SOCKET ERROR', errMsg);
            socket.disconnect(true);
            connection.end();
          });

          stream.on('data', (data) => {
            console.log(`Data${typeof JSON.stringify(data)}: `, data.toString('utf-8'));
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
            // SSHerror('STREAM CLOSE', errMsg);
            socket.disconnect(true);
            connection.end();
          });
          stream.stderr.on('data', (data) => {
            console.error(`STDERR: ${data}`);
          });
        },
      );
    });

    connection.on('end', (err) => {
      //SSHerror('CONN END BY HOST', err);
    });
    connection.on('close', (err) => {
      //SSHerror('CONN CLOSE', err);
    });
    connection.on('error', (err) => {
      //SSHerror('CONN ERROR', err);
    });
    // conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
    //   debugWebSSH2("conn.on('keyboard-interactive')");
    //   finish([socket.request.session.userpassword]);
    // });
    // console.log('hostkeys: ' + hostkeys[0].[0])
    // conn.connect({
    //   host: socket.request.session.ssh.host,
    //   port: socket.request.session.ssh.port,
    //   localAddress: socket.request.session.ssh.localAddress,
    //   localPort: socket.request.session.ssh.localPort,
    //   username: socket.request.session.username,
    //   password: socket.request.session.userpassword,
    //   privateKey: socket.request.session.privatekey,
    //   tryKeyboard: true,
    //   algorithms: socket.request.session.ssh.algorithms,
    //   readyTimeout: socket.request.session.ssh.readyTimeout,
    //   keepaliveInterval: socket.request.session.ssh.keepaliveInterval,
    //   keepaliveCountMax: socket.request.session.ssh.keepaliveCountMax,
    //   debug: debug('ssh2'),
    // });
    const devboxId = socket.request._query.devboxId;
    if (!devboxId) {
      console.error('No devboxId');
      throw new Error('No devboxId');
    }
    const sessionId = socket.request._query.sessionId;
    if (!sessionId) {
      console.error('No sessionId');
      throw new Error('No sessionId');
    }

    const environment = socket.request._query.env || 'prod';
    console.log(sessionId);
    await establishConnection(connection, socket, devboxId, sessionId, environment);
  }
  setupConnection();
};
