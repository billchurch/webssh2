// server
// app/ssh.js

const SSH = require("ssh2").Client
const EventEmitter = require("events")
const { createNamespacedDebug } = require("./logger")
const { SSHConnectionError, handleError } = require("./errors")
const { maskSensitiveData } = require("./utils")
const { DEFAULTS } = require("./constants")

const debug = createNamespacedDebug("ssh")

/**
 * SSHConnection class handles SSH connections and operations.
 * @extends EventEmitter
 */
class SSHConnection extends EventEmitter {
  constructor(config) {
    super()
    this.config = config
    this.conn = null
    this.stream = null
    this.creds = null
    this.authAttempts = 0
  }

  /**
   * Validates the format of an RSA private key
   * @param {string} key - The private key string to validate
   * @returns {boolean} - Whether the key appears to be valid
   */
  validatePrivateKey(key) {
    const keyPattern =
      /^-----BEGIN (?:RSA )?PRIVATE KEY-----\r?\n([A-Za-z0-9+/=\r\n]+)\r?\n-----END (?:RSA )?PRIVATE KEY-----\r?\n?$/
    return keyPattern.test(key)
  }

  /**
   * Attempts to connect using the provided credentials
   * @param {Object} creds - The credentials object
   * @returns {Promise<Object>} - A promise that resolves with the SSH connection
   */
  connect(creds) {
    debug("connect: %O", maskSensitiveData(creds))
    this.creds = creds
    return new Promise((resolve, reject) => {
      if (this.conn) {
        this.conn.end()
      }

      this.conn = new SSH()
      this.authAttempts = 0

      // First try with key authentication if available
      const sshConfig = this.getSSHConfig(creds, true)
      debug("Initial connection config: %O", maskSensitiveData(sshConfig))

      this.setupConnectionHandlers(resolve, reject)

      try {
        this.conn.connect(sshConfig)
      } catch (err) {
        reject(new SSHConnectionError(`Connection failed: ${err.message}`))
      }
    })
  }

  /**
   * Sets up SSH connection event handlers
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   */
  setupConnectionHandlers(resolve, reject) {
    this.conn.on("ready", () => {
      debug(`connect: ready: ${this.creds.host}`)
      resolve(this.conn)
    })

    this.conn.on("error", (err) => {
      debug(`connect: error: ${err.message}`)

      // Check if this is an authentication error and we haven't exceeded max attempts
      if (this.authAttempts < DEFAULTS.MAX_AUTH_ATTEMPTS) {
        this.authAttempts += 1
        debug(
          `Authentication attempt ${this.authAttempts} failed, trying password authentication`
        )

        // Only try password auth if we have a password
        if (this.creds.password) {
          debug("Retrying with password authentication")

          // Disconnect current connection
          if (this.conn) {
            this.conn.end()
          }

          // Create new connection with password authentication
          this.conn = new SSH()
          const passwordConfig = this.getSSHConfig(this.creds, false)

          this.setupConnectionHandlers(resolve, reject)
          this.conn.connect(passwordConfig)
        } else {
          debug("No password available, requesting password from client")
          this.emit("password-prompt", {
            host: this.creds.host,
            username: this.creds.username
          })

          // Listen for password response one time
          this.once("password-response", (password) => {
            this.creds.password = password
            const newConfig = this.getSSHConfig(this.creds, false)
            this.setupConnectionHandlers(resolve, reject)
            this.conn.connect(newConfig)
          })
        }
      } else {
        // We've exhausted all authentication attempts
        const error = new SSHConnectionError(
          "All authentication methods failed"
        )
        handleError(error)
        reject(error)
      }
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
  }

  /**
   * Generates the SSH configuration object based on credentials.
   * @param {Object} creds - The credentials object containing host, port, username, and optional password.
   * @param {boolean} useKey - Whether to attempt key authentication
   * @returns {Object} - The SSH configuration object.
   */
  getSSHConfig(creds, useKey) {
    const config = {
      host: creds.host,
      port: creds.port,
      username: creds.username,
      tryKeyboard: true,
      algorithms: this.config.ssh.algorithms,
      readyTimeout: this.config.ssh.readyTimeout,
      keepaliveInterval: this.config.ssh.keepaliveInterval,
      keepaliveCountMax: this.config.ssh.keepaliveCountMax,
      debug: createNamespacedDebug("ssh2")
    }

    // Try private key first if available and useKey is true
    if (useKey && (creds.privateKey || this.config.user.privateKey)) {
      debug("Using private key authentication")
      const privateKey = creds.privateKey || this.config.user.privateKey
      if (!this.validatePrivateKey(privateKey)) {
        throw new SSHConnectionError("Invalid private key format")
      }
      config.privateKey = privateKey
    } else if (creds.password) {
      debug("Using password authentication")
      config.password = creds.password
    }

    return config
  }

  /**
   * Opens an interactive shell session over the SSH connection.
   * @param {Object} options - Options for the shell
   * @param {Object} [envVars] - Environment variables to set
   * @returns {Promise<Object>} - A promise that resolves with the SSH shell stream
   */
  shell(options, envVars) {
    const shellOptions = Object.assign({}, options, {
      env: this.getEnvironment(envVars)
    })

    return new Promise((resolve, reject) => {
      this.conn.shell(shellOptions, (err, stream) => {
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

  /**
   * Gets the environment variables for the SSH session
   * @param {Object} envVars - Environment variables from URL
   * @returns {Object} - Combined environment variables
   */
  getEnvironment(envVars) {
    const env = {
      TERM: this.config.ssh.term
    }

    if (envVars) {
      Object.keys(envVars).forEach((key) => {
        env[key] = envVars[key]
      })
    }

    return env
  }
}

module.exports = SSHConnection
