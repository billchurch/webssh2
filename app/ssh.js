// server
// app/ssh.js
"use strict"

const createDebug = require("debug")
const debug = createDebug("webssh2:ssh")
const SSH = require("ssh2").Client
const maskObject = require('jsmasker');

function SSHConnection(config) {
  this.config = config
  this.conn = null
  this.stream = null
}

SSHConnection.prototype.connect = function(creds) {
  var self = this
  return new Promise(function(resolve, reject) {
    debug("connect: %O", maskObject(creds))

    if (self.conn) {
      self.conn.end()
    }

    self.conn = new SSH()
    
    var sshConfig = self.getSSHConfig(creds)
    
    self.conn.on("ready", function() {
      debug("connect: ready: " + creds.host)
      resolve()
    })

    self.conn.on("error", function(err) {
      console.error("connect: error:" + err.message)
      reject(err)
    })

    self.conn.connect(sshConfig)
  })
}

SSHConnection.prototype.getSSHConfig = function(creds) {
  return {
    host: creds.host,
    port: creds.port,
    username: creds.username,
    password: creds.password,
    tryKeyboard: true,
    algorithms: creds.algorithms || this.config.ssh.algorithms,
    readyTimeout: creds.readyTimeout || this.config.ssh.readyTimeout,
    keepaliveInterval: creds.keepaliveInterval || this.config.ssh.keepaliveInterval,
    keepaliveCountMax: creds.keepaliveCountMax || this.config.ssh.keepaliveCountMax,
    debug: createDebug("ssh")
  }
}

SSHConnection.prototype.shell = function(options) {
  var self = this
  return new Promise(function(resolve, reject) {
    self.conn.shell(options, function(err, stream) {
      if (err) {
        reject(err)
      } else {
        self.stream = stream
        resolve(stream)
      }
    })
  })
}

SSHConnection.prototype.resizeTerminal = function(rows, cols) {
  if (this.stream) {
    this.stream.setWindow(rows, cols)
  }
}

SSHConnection.prototype.end = function() {
  if (this.stream) {
    this.stream.end()
    this.stream = null
  }
  if (this.conn) {
    this.conn.end()
    this.conn = null
  }
}

module.exports = SSHConnection