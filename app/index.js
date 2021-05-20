/*
 * index.js
 *
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch/WebSSH2 - May 2017
 *
 */

const { config } = require('./server/app');
const { server } = require('./server/app');

server.listen({ host: config.listen.ip, port: config.listen.port });

// eslint-disable-next-line no-console
console.log(`WebSSH2 service listening on ${config.listen.ip}:${config.listen.port}`);

server.on('error', (err) => {
  console.error(`WebSSH2 server.listen ERROR: ${err.code}`);
});
