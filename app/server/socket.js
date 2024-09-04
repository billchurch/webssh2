// private
const debugWebSSH2 = require('debug')('WebSSH2');
const SSH = require('ssh2').Client;
const CIDRMatcher = require('cidr-matcher');
const validator = require('validator');
const dnsPromises = require('dns').promises;
const { Client } = require('ssh2');
const tls = require('tls');
const forge = require('node-forge');

function convertPKCS8toPKCS1(pkcs8Key) {
  const privateKeyInfo = forge.pki.privateKeyFromPem(pkcs8Key);

  // Convert the private key to PKCS#1 format
  const pkcs1Pem = forge.pki.privateKeyToPem(privateKeyInfo);

  return pkcs1Pem;
}

const sshKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCKspJS9rQGducF
WmE9Jh1ABKevG4k5qvdBC7SpGwnUacXFMQGpItHa6Soqw7ozKl0V6Mm1hsTWzciP
AeSc3zCcG9cuZu5YsX22b/iHk+xYPXTj4wEkkYpneaCk254c5tYTL+kEG24jEf/2
/Dld2oa6eQIHPZNDwC8ikndLKmvlv31xwuDsvjfljIqD49v0VwD19YDrM1f02SqK
/qzXkaaLnFdkk27aZNz7erLu2fUBGj1Qnul/ZljAoXI31QEs9wjQyn6ZfW8U96Md
3slCStiBXWCAW/IebnsE4z3k05tjNG8ha5tU9iG0BoAbGvpX2tceH9hs6PxMobh1
poebP2N9AgMBAAECggEAA8GRRTjpfYapJqkgxVtWYx5H0kNbJITU8bMuSdQcdd8F
cZvW+9cgZXQiEGAWQf4i4OMvL0DT7NihgVSfoICfhuLEIZK9CrQyf4cpwmDcVN7D
3yC4g7PYp95l3iu/wkWdb43rxWY0GzQIwWNpmaPqOSY/dVBoFWd2Kf1bHgiAkoti
VnUHefKfKR4oAJw5K1ZRx9wzThL1Sg1vcD86L1jWmG0ifXx6+q5bcPQcuYSJ91Rq
WprhGrvm6JBt9dCM/Qtaz5Kw7tW3bslIEgIuzMa84QqAKhB9BfCuO0x9ebn1KyRN
Gj5jCZC9IrgZyeliNlpYpeRb4Umbv6waS0yJ8auUawKBgQC52MXWRmP647zoz7Ed
TobnxvmhRlvPFuRl3dPvAviAD7ZRIkzerQaHKmm57NoSWutQ4bSQ2WTk+dcjSwPX
+m/9vCqiLa/3fOyZ6DyZeWBnq02p4gYuMANWtsISVH0gKTp4+PhpFf1JriUvx9fo
9yLbYfUkd3vnyUD1gqm+L7ntlwKBgQC/DY17fvwz9ST6zhrI52tOdDJ+Btad5nte
VjDn0Tq0yRryuJqWWzAc8RRieczNlc4jBlUmJgRK3Zp3LjpQwNFY4kLBAxBIhgfJ
iMZYnD6OxgtO+TUhdN4r7cUhVvbj4aiTWQ9d0CH4lDW3Z/vFnka1JM+mI4MYak1F
I5Jsc7ECCwKBgGqTfIiv30AOf9QG3uwOj2C1g4xP+/BbkWk1eAc17eoKmKQYhnqg
QQEcensL79bc2tuMQ+9ZK/n/qLdtmmuuC7E3yj8s8h98PXbZbn8Y0wdAfo4wtxif
ohqFPfAjEYpy+jxLkrE40gMB4gNvmEraBtxGZb2e46h9ikoAv3T4i6hLAoGAMiok
1CBrqFjd9NzZO5dIHbl06JJzF9LE4ehPvw65E28anFDMhl47K95BM/o3RGPpVFj9
Up740Y+OV2zT8xAt5+DBFlzvkZtfwBMhwXKFGof1wC6/PKGrFG3CLRbgjMVbthTU
bBWSVerUj+vFuAXvGvEndMAuU+LVlynX8JIQEDECgYEAnnbkbcE3yEffRBYJNMtU
Q57iTjpNThulk8xpo0dJpM3qEgNWJUGJHo7WjTr9ZQdMMAzYbH6UbaKhzzpEt6oL
bw2e5t5vittkqw30WRqX7oY0bP+0jPxcJ2UsiyrtEVeKFfpumPha2I3SD6nFuBWW
9ELc23WVPO3G0w6LGfBEfUQ=
-----END RSA PRIVATE KEY-----`;

const conn = new Client();

// Function to create a TLS connection (simulating ProxyCommand with openssl s_client)
const proxyConnect = (hostname, callback) => {
  const tlsSocket = tls.connect(
    {
      host: 'ssh.runloop.pro', // Proxy server address
      port: 443, // Proxy port (HTTPS over TLS)
      servername: hostname, // Target hostname, acts like -servername in openssl
      checkServerIdentity: () => {
        return undefined;
      }, // Disable hostname validation
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

const hostname =
  'devbox-0191be26-2418-758d-8100-7d9fff932b8d.38408049-afa6-4fe0-a4a1-4d120d39c1cd.ssh.runloop.pro';
// Main function to establish the SSH connection over the TLS proxy
function establishConnection() {
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
      .on('error', (err) => {
        console.error('SSH Connection error:', err);
      })
      .connect({
        sock: tlsSocket, // Pass the TLS socket as the connection
        username: 'user', // Replace with the correct SSH username
        privateKey: convertPKCS8toPKCS1(sshKey), // Replace with the path to your private key
        hostHash: 'md5', // Optional: Match host keys by hash
        strictHostKeyChecking: false, // Disable strict host key checking
      });
  });
}
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
            `WebSSH2 ${'error: Authentication failure'.red.bold} user=${socket.request.session.username.yellow.bold.underline} from=${socket.handshake.address.yellow.bold.underline}`,
          );
          socket.emit('allowreauth', socket.request.session.ssh.allowreauth);
          socket.emit('reauth');
        } else {
          // eslint-disable-next-line no-console
          console.log(
            `WebSSH2 Logout: user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host} port=${socket.request.session.ssh.port} sessionID=${socket.request.sessionID}/${socket.id} allowreplay=${socket.request.session.ssh.allowreplay} term=${socket.request.session.ssh.term}`,
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
            } from=${socket.handshake.address.yellow.bold.underline}`,
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
          }`,
        );
        socket.emit('ssherror', '401 UNAUTHORIZED');
        socket.disconnect(true);
        return;
      }
    }

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
      debugWebSSH2(
        `WebSSH2 Login: user=${socket.request.session.username} from=${socket.handshake.address} host=${socket.request.session.ssh.host} port=${socket.request.session.ssh.port} sessionID=${socket.request.sessionID}/${socket.id} mrhsession=${socket.request.session.ssh.mrhsession} allowreplay=${socket.request.session.ssh.allowreplay} term=${socket.request.session.ssh.term}`,
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
        `ssh://${socket.request.session.username}@${socket.request.session.ssh.host}:${socket.request.session.ssh.port}`,
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
        },
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
      console.log('EVAN HERE');
      establishConnection();
    } else {
      debugWebSSH2(
        `Attempt to connect without session.username/password or session varialbles defined, potentially previously abandoned client session. disconnecting websocket client.\r\nHandshake information: \r\n  ${JSON.stringify(
          socket.handshake,
        )}`,
      );
      socket.emit('ssherror', 'WEBSOCKET ERROR - Refresh the browser and try again');
      socket.request.session.destroy();
      socket.disconnect(true);
    }
  }
  setupConnection();
  // establishConnection();
};
