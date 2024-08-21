// server
// app/socket.js

const createDebug = require("debug")
const maskObject = require("jsmasker")
const validator = require("validator")
const SSHConnection = require("./ssh")

const debug = createDebug("webssh2:socket")
const { validateSshTerm, isValidCredentials } = require("./utils")

class WebSSH2Socket {
  /**
   * Creates an instance of WebSSH2Socket.
   * @param {SocketIO.Socket} socket - The socket instance.
   * @param {Object} config - The configuration object.
   */
  constructor(socket, config) {
    this.socket = socket
    this.config = config
    this.ssh = new SSHConnection(config)
    this.sessionState = {
      authenticated: false,
      username: null,
      password: null,
      host: null,
      port: null,
      term: null,
      cols: null,
      rows: null
    }
    this.initializeSocketEvents()
  }

  /**
   * Initializes the socket event listeners.
   */
  initializeSocketEvents() {
    debug(`io.on connection: ${this.socket.id}`)

    if (
      this.socket.handshake.session.usedBasicAuth &&
      this.socket.handshake.session.sshCredentials
    ) {
      const creds = this.socket.handshake.session.sshCredentials
      debug(
        `handleConnection: ${this.socket.id}, Host: ${creds.host}: HTTP Basic Credentials Exist, creds: %O`,
        maskObject(creds)
      )
      this.handleAuthenticate(creds)
    } else if (!this.sessionState.authenticated) {
      debug(`handleConnection: ${this.socket.id}, emitting request_auth`)
      this.socket.emit("authentication", { action: "request_auth" })
    }

    this.socket.on("authenticate", creds => this.handleAuthenticate(creds))
    this.socket.on("terminal", data => this.handleTerminal(data))
    this.socket.on("disconnect", reason => this.handleConnectionClose(reason))
  }

  /**
   * Handles the authentication process.
   * @param {Object} creds - The credentials for authentication.
   */
  handleAuthenticate(creds) {
    debug(`handleAuthenticate: ${this.socket.id}, %O`, maskObject(creds))

    if (isValidCredentials(creds)) {
      this.sessionState.term = validateSshTerm(creds.term)
        ? creds.term
        : this.config.ssh.term
      this.initializeConnection(creds)
    } else {
      console.warn(`handleAuthenticate: ${this.socket.id}, CREDENTIALS INVALID`)
      this.socket.emit("authentication", {
        success: false,
        message: "Invalid credentials format"
      })
    }
  }

  /**
   * Initializes the SSH connection.
   * @param {Object} creds - The credentials for the SSH connection.
   */
  initializeConnection(creds) {
    debug(
      `initializeConnection: ${this.socket.id}, INITIALIZING SSH CONNECTION: Host: ${creds.host}, creds: %O`,
      maskObject(creds)
    )

    this.ssh
      .connect(creds)
      .then(() => {
        this.sessionState = Object.assign({}, this.sessionState, {
          authenticated: true,
          username: creds.username,
          password: creds.password,
          host: creds.host,
          port: creds.port
        })

        const authResult = { action: "auth_result", success: true }
        this.socket.emit("authentication", authResult)

        const permissions = {
          autoLog: this.config.options.autoLog || false,
          allowReplay: this.config.options.allowReplay || false,
          allowReconnect: this.config.options.allowReconnect || false,
          allowReauth: this.config.options.allowReauth || false
        }
        this.socket.emit("permissions", permissions)

        this.updateElement("footer", `ssh://${creds.host}:${creds.port}`)

        if (this.config.header && this.config.header.text !== null) {
          this.updateElement("header", this.config.header.text)
        }

        this.socket.emit("getTerminal", true)
      })
      .catch(err => {
        console.error(
          `initializeConnection: SSH CONNECTION ERROR: ${this.socket.id}, Host: ${creds.host}, Error: ${err.message}`
        )
        this.handleError("SSH CONNECTION ERROR", err)
      })
  }

  /**
   * Handles terminal data.
   * @param {Object} data - The terminal data.
   */
  handleTerminal(data) {
    const { term, rows, cols } = data
    if (term && validateSshTerm(term)) this.sessionState.term = term
    if (rows && validator.isInt(rows.toString()))
      this.sessionState.rows = parseInt(rows, 10)
    if (cols && validator.isInt(cols.toString()))
      this.sessionState.cols = parseInt(cols, 10)

    this.createShell()
  }

  /**
   * Creates a new SSH shell session.
   */
  createShell() {
    this.ssh
      .shell({
        term: this.sessionState.term,
        cols: this.sessionState.cols,
        rows: this.sessionState.rows
      })
      .then(stream => {
        stream.on("data", data =>
          this.socket.emit("data", data.toString("utf-8"))
        )
        stream.stderr.on("data", data => debug(`STDERR: ${data}`))
        stream.on("close", (code, signal) =>
          this.handleConnectionClose(code, signal)
        )

        this.socket.on("data", data => stream.write(data))
        this.socket.on("control", controlData =>
          this.handleControl(controlData)
        )
        this.socket.on("resize", data => this.handleResize(data))
      })
      .catch(err => this.handleError("SHELL ERROR", err))
  }

  /**
   * Handles the resize event for the terminal.
   * @param {Object} data - The resize data.
   */
  handleResize(data) {
    const { rows, cols } = data
    if (this.ssh.stream) {
      if (rows && validator.isInt(rows.toString()))
        this.sessionState.rows = parseInt(rows, 10)
      if (cols && validator.isInt(cols.toString()))
        this.sessionState.cols = parseInt(cols, 10)
      this.ssh.resizeTerminal(this.sessionState.rows, this.sessionState.cols)
    }
  }

  /**
   * Handles control commands.
   * @param {string} controlData - The control command received.
   */
  handleControl(controlData) {
    if (
      validator.isIn(controlData, ["replayCredentials", "reauth"]) &&
      this.ssh.stream
    ) {
      if (controlData === "replayCredentials") {
        this.replayCredentials()
      } else if (controlData === "reauth") {
        this.handleReauth()
      }
    } else {
      console.warn(
        `handleControl: Invalid control command received: ${controlData}`
      )
    }
  }

  /**
   * Replays stored credentials.
   */
  replayCredentials() {
    if (this.config.options.allowReplay && this.ssh.stream) {
      this.ssh.stream.write(`${this.sessionState.password}\n`)
    }
  }

  /**
   * Handles reauthentication.
   */
  handleReauth() {
    if (this.config.options.allowReauth) {
      this.clearSessionCredentials()
      this.socket.emit("authentication", { action: "reauth" })
    }
  }

  /**
   * Handles errors.
   * @param {string} context - The error context.
   * @param {Error} err - The error object.
   */
  handleError(context, err) {
    const errorMessage = err ? `: ${err.message}` : ""
    this.socket.emit("ssherror", `SSH ${context}${errorMessage}`)
    this.handleConnectionClose()
  }

  /**
   * Updates a UI element on the client side.
   * @param {string} element - The element to update.
   * @param {any} value - The new value for the element.
   */
  updateElement(element, value) {
    this.socket.emit("updateUI", { element, value })
  }

  /**
   * Handles the closure of the connection.
   * @param {string} reason - The reason for the closure.
   */
  handleConnectionClose(reason) {
    if (this.ssh) this.ssh.end()
    debug(`handleConnectionClose: ${this.socket.id}, Reason: ${reason}`)
    this.socket.disconnect(true)
  }

  /**
   * Clears session credentials.
   */
  clearSessionCredentials() {
    if (this.socket.handshake.session.sshCredentials) {
      this.socket.handshake.session.sshCredentials.username = null
      this.socket.handshake.session.sshCredentials.password = null
    }
    this.socket.handshake.session.usedBasicAuth = false
    this.sessionState.authenticated = false
    this.sessionState.username = null
    this.sessionState.password = null

    this.socket.handshake.session.save(err => {
      if (err)
        console.error(`Failed to save session for ${this.socket.id}:`, err)
    })
  }
}

module.exports = function(io, config) {
  io.on("connection", socket => new WebSSH2Socket(socket, config))
}
