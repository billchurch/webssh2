// server
// app/ssh.js

const SSH = require("ssh2").Client
const maskObject = require("jsmasker")
const { createNamespacedDebug } = require("./logger")
const { SSHConnectionError, handleError } = require("./errors")

const debug = createNamespacedDebug("ssh")

function SSHConnection(config) {
  this.config = config
  this.conn = null
  this.stream = null
}

SSHConnection.prototype.connect = function(creds) {
  const self = this
  return new Promise(function(resolve, reject) {
    debug("connect: %O", maskObject(creds))

    if (self.conn) {
      self.conn.end()
    }

    self.conn = new SSH()

    const sshConfig = self.getSSHConfig(creds)

    self.conn.on("ready", function() {
      debug(`connect: ready: ${creds.host}`)
      resolve()
    })

    self.conn.on("error", function(err) {
      const error = new SSHConnectionError(
        `SSH Connection error: ${err.message}`
      )
      handleError(error)
      reject(error)
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
    keepaliveInterval:
      creds.keepaliveInterval || this.config.ssh.keepaliveInterval,
    keepaliveCountMax:
      creds.keepaliveCountMax || this.config.ssh.keepaliveCountMax,
    debug: createNamespacedDebug("ssh2")
  }
}

SSHConnection.prototype.shell = function(options) {
  const self = this
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
