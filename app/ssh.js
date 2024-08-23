// server
// app/ssh.js

const SSH = require("ssh2").Client
const EventEmitter = require("events")
const { createNamespacedDebug } = require("./logger")
const { SSHConnectionError, handleError } = require("./errors")
const { maskSensitiveData } = require("./utils")

const debug = createNamespacedDebug("ssh")

/**
 * SSHConnection class handles SSH connections and operations.
 * @extends EventEmitter
 */
class SSHConnection extends EventEmitter {
  /**
   * Create an SSHConnection.
   * @param {Object} config - Configuration object for the SSH connection.
   */
  constructor(config) {
    super()
    this.config = config
    this.conn = null
    this.stream = null
    this.creds = null
  }

  /**
   * Connects to the SSH server using the provided credentials.
   * @param {Object} creds - The credentials object containing host, port, username, and password.
   * @returns {Promise<SSH>} - A promise that resolves with the SSH connection instance.
   */
  connect(creds) {
    this.creds = creds
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
        const error = new SSHConnectionError(`${err.message}`)
        handleError(error)
        reject(error)
      })

      this.conn.on(
        "keyboard-interactive",
        (name, instructions, lang, prompts, finish) => {
          this.handleKeyboardInteractive(
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
   * @param {string} name - The name of the authentication request.
   * @param {string} instructions - The instructions for the keyboard-interactive prompt.
   * @param {string} lang - The language of the prompt.
   * @param {Array<Object>} prompts - The list of prompts provided by the server.
   * @param {Function} finish - The callback to complete the keyboard-interactive authentication.
   */
  handleKeyboardInteractive(name, instructions, lang, prompts, finish) {
    debug("handleKeyboardInteractive: Keyboard-interactive auth %O", prompts)

    // Check if we should always send prompts to the client
    if (this.config.ssh.alwaysSendKeyboardInteractivePrompts) {
      this.sendPromptsToClient(name, instructions, prompts, finish)
      return
    }

    const responses = []
    let shouldSendToClient = false

    for (let i = 0; i < prompts.length; i += 1) {
      if (
        prompts[i].prompt.toLowerCase().includes("password") &&
        this.creds.password
      ) {
        responses.push(this.creds.password)
      } else {
        shouldSendToClient = true
        break
      }
    }

    if (shouldSendToClient) {
      this.sendPromptsToClient(name, instructions, prompts, finish)
    } else {
      finish(responses)
    }
  }

  /**
   * Sends prompts to the client for keyboard-interactive authentication.
   *
   * @param {string} name - The name of the authentication method.
   * @param {string} instructions - The instructions for the authentication.
   * @param {Array<{ prompt: string, echo: boolean }>} prompts - The prompts to be sent to the client.
   * @param {Function} finish - The callback function to be called when the client responds.
   */
  sendPromptsToClient(name, instructions, prompts, finish) {
    this.emit("keyboard-interactive", {
      name: name,
      instructions: instructions,
      prompts: prompts.map(p => ({ prompt: p.prompt, echo: p.echo }))
    })

    this.once("keyboard-interactive-response", responses => {
      finish(responses)
    })
  }

  /**
   * Generates the SSH configuration object based on credentials.
   * @param {Object} creds - The credentials object containing host, port, username, and password.
   * @returns {Object} - The SSH configuration object.
   */
  getSSHConfig(creds) {
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
   * @param {Object} [options] - Optional parameters for the shell.
   * @returns {Promise<Object>} - A promise that resolves with the SSH shell stream.
   */
  shell(options) {
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
   * @param {number} rows - The number of rows for the terminal.
   * @param {number} cols - The number of columns for the terminal.
   */
  resizeTerminal(rows, cols) {
    if (this.stream) {
      this.stream.setWindow(rows, cols)
    }
  }

  /**
   * Ends the SSH connection and stream.
   */
  end() {
    if (this.stream) {
      this.stream.end()
      this.stream = null
    }
    if (this.conn) {
      this.conn.end()
      this.conn = null
    }
  }
}

module.exports = SSHConnection
