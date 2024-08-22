// server
// app/ssh.js

const SSH = require("ssh2").Client
const { createNamespacedDebug } = require("./logger")
const { SSHConnectionError, handleError } = require("./errors")
const { maskSensitiveData } = require("./utils")

const debug = createNamespacedDebug("ssh")

/**
 * SSHConnection class handles SSH connections and operations.
 * @class
 * @param {Object} config - Configuration object for the SSH connection.
 */
function SSHConnection(config) {
  this.config = config
  this.conn = null
  this.stream = null
}

/**
 * Connects to the SSH server using the provided credentials.
 * @function
 * @memberof SSHConnection
 * @param {Object} creds - The credentials object containing host, port, username, and password.
 * @returns {Promise<SSH>} - A promise that resolves with the SSH connection instance.
 */
SSHConnection.prototype.connect = function(creds) {
  debug("connect: %O", maskSensitiveData(creds))
  return new Promise((resolve, reject) => {
    if (this.conn) {
      this.conn.end()
    }

    this.conn = new SSH()

    const sshConfig = this.getSSHConfig(creds)

    this.conn.on("ready", () => {
      debug(`connect: ready: ${creds.host}`)
      resolve(this.conn)
    })

    this.conn.on("error", err => {
      const error = new SSHConnectionError(
        `SSH Connection error: ${err.message}`
      )
      handleError(error)
      reject(error)
    })

    this.conn.on(
      "keyboard-interactive",
      (name, instructions, lang, prompts, finish) => {
        this.handleKeyboardInteractive(
          creds,
          name,
          instructions,
          lang,
          prompts,
          finish
        )
      }
    )

    this.conn.connect(sshConfig)
  })
}

/**
 * Handles keyboard-interactive authentication prompts.
 * @function
 * @memberof SSHConnection
 * @param {Object} creds - The credentials object containing password.
 * @param {string} name - The name of the authentication request.
 * @param {string} instructions - The instructions for the keyboard-interactive prompt.
 * @param {string} lang - The language of the prompt.
 * @param {Array<Object>} prompts - The list of prompts provided by the server.
 * @param {Function} finish - The callback to complete the keyboard-interactive authentication.
 */
SSHConnection.prototype.handleKeyboardInteractive = function(
  creds,
  name,
  instructions,
  lang,
  prompts,
  finish
) {
  debug("handleKeyboardInteractive: Keyboard-interactive auth %O", prompts)
  const responses = []

  for (let i = 0; i < prompts.length; i += 1) {
    if (prompts[i].prompt.toLowerCase().includes("password")) {
      responses.push(creds.password)
    } else {
      // todo: For any non-password prompts, we meed to implement a way to
      // get responses from the user through a modal. For now, we'll just
      // send an empty string
      responses.push("")
    }
  }

  finish(responses)
}

/**
 * Generates the SSH configuration object based on credentials.
 * @function
 * @memberof SSHConnection
 * @param {Object} creds - The credentials object containing host, port, username, and password.
 * @returns {Object} - The SSH configuration object.
 */
SSHConnection.prototype.getSSHConfig = function(creds) {
  return {
    host: creds.host,
    port: creds.port,
    username: creds.username,
    password: creds.password,
    tryKeyboard: true,
    algorithms: this.config.ssh.algorithms,
    readyTimeout: this.config.ssh.readyTimeout,
    keepaliveInterval: this.config.ssh.keepaliveInterval,
    keepaliveCountMax: this.config.ssh.keepaliveCountMax,
    debug: createNamespacedDebug("ssh2")
  }
}

/**
 * Opens an interactive shell session over the SSH connection.
 * @function
 * @memberof SSHConnection
 * @param {Object} [options] - Optional parameters for the shell.
 * @returns {Promise<Object>} - A promise that resolves with the SSH shell stream.
 */
SSHConnection.prototype.shell = function(options) {
  return new Promise((resolve, reject) => {
    this.conn.shell(options, (err, stream) => {
      if (err) {
        reject(err)
      } else {
        this.stream = stream
        resolve(stream)
      }
    })
  })
}

/**
 * Resizes the terminal window for the current SSH session.
 * @function
 * @memberof SSHConnection
 * @param {number} rows - The number of rows for the terminal.
 * @param {number} cols - The number of columns for the terminal.
 */
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