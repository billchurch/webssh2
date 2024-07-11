'use strict'
/* jshint esversion: 6, asi: true, node: true */
/*
 * index.js
 *
 * WebSSH2 - Web to SSH2 gateway
 * Bill Church - https://github.com/billchurch/WebSSH2 - May 2017
 *
 */
const { server, config } = require('./app/app')

server.listen(config.listen.port, config.listen.ip, () => {
  console.log(
    `WebSSH2 service listening on ${config.listen.ip}:${config.listen.port}`
  )
})

server.on('error', function (err) {
  console.log('WebSSH2 server.listen ERROR: ' + err.code)
})
