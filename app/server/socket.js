// private
const debugWebSSH2 = require('debug')('WebSSH2');
const SSH = require('ssh2').Client;
const CIDRMatcher = require('cidr-matcher');
const validator = require('validator');
const dnsPromises = require('dns').promises;
const debug = require('debug');
const { Client } = require('ssh2');
const tls = require('tls');
const forge = require('node-forge');
const { Runloop } = require('@runloop/api-client');

function convertPKCS8toPKCS1(pkcs8Key) {
  const privateKeyInfo = forge.pki.privateKeyFromPem(pkcs8Key);

  // Convert the private key to PKCS#1 format
  const pkcs1Pem = forge.pki.privateKeyToPem(privateKeyInfo);
  return pkcs1Pem;
}

const conn = new Client();

// Function to create a TLS connection (simulating ProxyCommand with openssl s_client)
const proxyConnect = (hostname, callback) => {
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
};

// Main function to establish the SSH connection over the TLS proxy
async function establishConnection(targetDevbox, bearerToken) {
  const runloop = new Runloop({
    baseURL: 'https://api.runloop.pro',
    // This is gotten by just inspecting the browser cookies on platform.runloop.pro
    bearerToken,
  });

  const sshKeyCreateResp = await runloop.devboxes.createSSHKey(targetDevbox);
  const hostname = sshKeyCreateResp.url;
  console.log('EVAN SSH KEY RESP', sshKeyCreateResp);

  // SS KEY
  // Environment
  // Get ssh config information
  proxyConnect(hostname, (err, tlsSocket) => {
    if (err) {
      console.error('Error during proxy connection:', err);
      return;
    }

    // Now use ssh2 to connect over the TLS socket
    conn
      .on('ready', () => {
        console.log('SSH Client ready');
        // conn.exec("uptime", (err, stream) => {
        //   if (err) throw err;
        //   stream
        //     .on("close", (code, signal) => {
        //       console.log(
        //         "Stream :: close :: code: " + code + ", signal: " + signal
        //       );
        //       conn.end();
        //     })
        //     .on("data", (data) => {
        //       console.log("STDOUT: " + data);
        //     })
        //     .stderr.on("data", (data) => {
        //       console.log("STDERR: " + data);
        //     });
        // });
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
}
let termCols;
let termRows;

// public
module.exports = function appSocket(socket) {
  async function setupConnection() {
    // TODO AUTH?
    // if websocket connection arrives without an express session, kill it
    // if (!socket.request.session) {
    //   socket.emit('401 UNAUTHORIZED');
    //   debugWebSSH2('SOCKET: No Express Session / REJECTED');
    //   socket.disconnect(true);
    //   return;
    // }

    // const conn = new SSH();
    socket.on('geometry', (cols, rows) => {
      termCols = cols;
      termRows = rows;
    });
    conn.on('banner', (data) => {
      // need to convert to cr/lf for proper formatting
      socket.emit('data', data.replace(/\r?\n/g, '\r\n').toString('utf-8'));
    });

    conn.on('ready', () => {
      // debugWebSSH2(
      //   `WebSSH2 Login: user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host} port=${socket.request.session.ssh.port} sessionID=${socket.request.sessionID}/${socket.id} mrhsession=${socket.request.session.ssh.mrhsession} allowreplay=${socket.request.session.ssh.allowreplay} term=${socket.request.session.ssh.term}`,
      // );
      socket.emit('setTerminalOpts', {
        cursorBlink: true,
        scrollback: 10000,
        tabStopWidth: 8,
        bellStyle: 'sound',
      });
      conn.shell(
        {
          term: 'xterm-color',
          cols: termCols,
          rows: termRows,
        },
        (err, stream) => {
          if (err) {
            // SSHerror(`EXEC ERROR${err}`);
            conn.end();
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
            //const errMsg = { message: reason };
            // SSHerror('CLIENT SOCKET DISCONNECT', errMsg);
            conn.end();
            // socket.request.session.destroy()
          });
          socket.on('error', (errMsg) => {
            // SSHerror('SOCKET ERROR', errMsg);
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
            //SSHerror('STREAM CLOSE', errMsg);
            conn.end();
          });
          stream.stderr.on('data', (data) => {
            console.error(`STDERR: ${data}`);
          });
        },
      );
    });

    conn.on('end', (err) => {
      //SSHerror('CONN END BY HOST', err);
    });
    conn.on('close', (err) => {
      //SSHerror('CONN CLOSE', err);
    });
    conn.on('error', (err) => {
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
    await establishConnection(
      'dbx_2xb6oS1G1e6TAihVMtjn6',
      'ss_eyJhbGciOiJIUzI1NiIsImtpZCI6IkEyZExNNUlheFE4L29acW4iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2t5aGpvaG1xbXFrdmZxc2t4dnNkLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI5NmRlMTVjZC1lZWJmLTRjNzctODQwNy1jZTkwNzNlZTZkMjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzI1NDg1NTQwLCJpYXQiOjE3MjU0ODE5NDAsImVtYWlsIjoiYWxleEBydW5sb29wLmFpIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCIsImdpdGh1YiJdfSwidXNlcl9tZXRhZGF0YSI6eyJhdmF0YXJfdXJsIjoiaHR0cHM6Ly9hdmF0YXJzLmdpdGh1YnVzZXJjb250ZW50LmNvbS91LzE2MDA3NzkyND92PTQiLCJlbWFpbCI6ImFsZXhAcnVubG9vcC5haSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJBbGV4YW5kZXIgRGluZXMiLCJpc3MiOiJodHRwczovL2FwaS5naXRodWIuY29tIiwibmFtZSI6IkFsZXhhbmRlciBEaW5lcyIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwicHJlZmVycmVkX3VzZXJuYW1lIjoiZGluZXMtcmwiLCJwcm92aWRlcl9pZCI6IjE2MDA3NzkyNCIsInN1YiI6IjE2MDA3NzkyNCIsInVzZXJfbmFtZSI6ImRpbmVzLXJsIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoib2F1dGgiLCJ0aW1lc3RhbXAiOjE3MjM1OTAxODB9XSwic2Vzc2lvbl9pZCI6IjU5MjhkZTIxLTI3M2ItNDkzNC1iMGFmLThlYWE3MDUxOGE3MiIsImlzX2Fub255bW91cyI6ZmFsc2V9.Qby46q2eDZUWjpPPSvmyzQ5bGKGEkpg2r9zBAUTpc3Q',
    );
  }
  setupConnection();
};
