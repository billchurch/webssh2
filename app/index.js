/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
/* jshint esversion: 6, asi: true, node: true */

const { config } = require('./server/app');
const { server } = require('./server/app');

server.listen({ host: config.listen.ip, port: config.listen.port });

console.log(`WebSSH2 service listening on ${config.listen.ip}:${config.listen.port}`);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    config.listen.port += 1;
    console.warn(`WebSSH2 Address in use, retrying on port ${config.listen.port}`);
    setTimeout(() => {
      server.listen(config.listen.port);
    }, 250);
  } else {
    // eslint-disable-next-line no-console
    console.log(`WebSSH2 server.listen ERROR: ${err.code}`);
  }
});
