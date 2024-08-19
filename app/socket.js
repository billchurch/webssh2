// server
// app/socket.js
"use strict"

var createDebug = require("debug")
var debug = createDebug("webssh2:socket")
var SSHConnection = require("./ssh")
var { sanitizeObject, validateSshTerm } = require("./utils")
var validator = require("validator")

module.exports = function (io, config) {
  io.on("connection", function (socket) {
    debug("io.on connection: " + socket.id)
    var ssh = new SSHConnection(config)
    var sessionState = {
      authenticated: false,
      username: null,
      password: null,
      host: null,
      port: null,
      term: null,
      cols: null,
      rows: null
    }

    /**
     * Handles socket connections and SSH authentication for the webssh2 application.
     *
     * @param {SocketIO.Server} io - The Socket.IO server instance.
     * @param {Object} config - The configuration object.
     */
    function handleAuthenticate(creds) {
      debug("handleAuthenticate: " + socket.id + ", %O", sanitizeObject(creds))

      if (isValidCredentials(creds)) {
        sessionState.term = validateSshTerm(creds.term)
          ? creds.term
          : config.ssh.term
        initializeConnection(creds)
      } else {
        console.warn(
          "handleAuthenticate: " + socket.id + ", CREDENTIALS INVALID"
        )
        socket.emit("authentication", {
          success: false,
          message: "Invalid credentials format"
        })
      }
    }

    /**
     * Initializes an SSH connection using the provided credentials.
     *
     * @param {Object} creds - The credentials required to establish the SSH connection.
     * @param {string} creds.host - The hostname or IP address of the SSH server.
     * @param {string} creds.username - The username for SSH authentication.
     * @param {string} creds.password - The password for SSH authentication.
     * @param {string} [creds.privateKey] - The private key for SSH authentication (optional).
     * @param {string} [creds.passphrase] - The passphrase for the private key (optional).
     */
    function initializeConnection(creds) {
      debug(
        "initializeConnection: " +
          socket.id +
          ", INITIALIZING SSH CONNECTION: Host: " +
          creds.host +
          ", creds: %O",
        sanitizeObject(creds)
      )

      ssh
        .connect(creds)
        .then(function () {
          sessionState.authenticated = true
          sessionState.username = creds.username
          sessionState.password = creds.password
          sessionState.host = creds.host
          sessionState.port = creds.port

          debug(
            "initializeConnection: " +
              socket.id +
              " conn.on ready: Host: " +
              creds.host
          )
          console.log(
            "initializeConnection: " +
              socket.id +
              " conn.on ready: " +
              creds.username +
              "@" +
              creds.host +
              ":" +
              creds.port +
              " successfully connected"
          )

          var auth_result = { action: "auth_result", success: true }
          debug(
            "initializeConnection: " +
              socket.id +
              " conn.on ready: emitting authentication: " +
              JSON.stringify(auth_result)
          )
          socket.emit("authentication", auth_result)

          // Emit consolidated permissions
          var permissions = {
            autoLog: config.options.autoLog || false,
            allowReplay: config.options.allowReplay || false,
            allowReconnect: config.options.allowReconnect || false,
            allowReauth: config.options.allowReauth || false
          }
          debug(
            "initializeConnection: " +
              socket.id +
              " conn.on ready: emitting permissions: " +
              JSON.stringify(permissions)
          )
          socket.emit("permissions", permissions)

          updateElement("footer", "ssh://" + creds.host + ":" + creds.port)

          if (config.header && config.header.text !== null) {
            debug("initializeConnection header: " + config.header)
            updateElement("header", config.header.text)
          }

          // Request terminal information from client
          socket.emit("getTerminal", true)
        })
        .catch(function (err) {
          console.error(
            "initializeConnection: SSH CONNECTION ERROR: " +
              socket.id +
              ", Host: " +
              creds.host +
              ", Error: " +
              err.message
          )
          if (err.level === "client-authentication") {
            socket.emit("authentication", {
              action: "auth_result",
              success: false,
              message: "Authentication failed"
            })
          } else {
            handleError("SSH CONNECTION ERROR", err)
          }
        })
    }

    /**
     * Handles the terminal data.
     *
     * @param {Object} data - The terminal data.
     * @param {string} data.term - The terminal term.
     * @param {number} data.rows - The number of rows.
     * @param {number} data.cols - The number of columns.
     * @returns {void}
     */
    function handleTerminal(data) {
      debug("handleTerminal: Received terminal data: " + JSON.stringify(data))
      var term = data.term
      var rows = data.rows
      var cols = data.cols

      if (term && validateSshTerm(term)) {
        sessionState.term = term
        debug("handleTerminal: Set term to " + sessionState.term)
      }

      if (rows && validator.isInt(rows.toString())) {
        sessionState.rows = parseInt(rows, 10)
        debug("handleTerminal: Set rows to " + sessionState.rows)
      }

      if (cols && validator.isInt(cols.toString())) {
        sessionState.cols = parseInt(cols, 10)
        debug("handleTerminal: Set cols to " + sessionState.cols)
      }

      // Now that we have terminal information, we can create the shell
      createShell()
    }

    /**
     * Creates a shell using SSH and establishes a bidirectional communication between the shell and the socket.
     *
     * @function createShell
     * @memberof module:socket
     * @returns {void}
     */
    function createShell() {
      ssh
        .shell({
          term: sessionState.term,
          cols: sessionState.cols,
          rows: sessionState.rows
        })
        .then(function (stream) {
          stream.on("data", function (data) {
            socket.emit("data", data.toString("utf-8"))
          })

          stream.stderr.on("data", function (data) {
            debug("STDERR: " + data)
          })

          stream.on("close", function (code, signal) {
            debug("handleStreamClose: " + socket.id)
            handleConnectionClose()
          })

          socket.on("data", function (data) {
            if (stream) {
              stream.write(data)
            }
          })

          socket.on("control", function (controlData) {
            handleControl(controlData)
          })

          socket.on("resize", function (data) {
            handleResize(data)
          })
        })
        .catch(function (err) {
          handleError("SHELL ERROR", err)
        })
    }

    /**
     * Handles the resize event of the terminal.
     *
     * @param {Object} data - The resize data containing the number of rows and columns.
     */
    function handleResize(data) {
      var rows = data.rows
      var cols = data.cols

      if (ssh.stream) {
        if (rows && validator.isInt(rows.toString())) {
          sessionState.rows = parseInt(rows, 10)
        }
        if (cols && validator.isInt(cols.toString())) {
          sessionState.cols = parseInt(cols, 10)
        }
        debug(
          "Resizing terminal to " + sessionState.rows + "x" + sessionState.cols
        )
        ssh.resizeTerminal(sessionState.rows, sessionState.cols)
      }
    }

    /**
     * Handles control data received from the client.
     *
     * @param {string} controlData - The control data received.
     * @returns {void}
     */
    function handleControl(controlData) {
      debug("handleControl: Received control data: " + controlData)
      if (
        validator.isIn(controlData, ["replayCredentials", "reauth"]) &&
        ssh.stream
      ) {
        if (controlData === "replayCredentials") {
          replayCredentials()
        } else if (controlData === "reauth") {
          handleReauth()
        }
      } else {
        console.warn(
          "handleControl: Invalid control command received: " + controlData
        )
      }
    }

    /**
     * Replays the stored credentials for the current session.
     *
     * @returns {void}
     */
    function replayCredentials() {
      var password = sessionState.password
      var allowReplay = config.options.allowReplay || false

      if (allowReplay && ssh.stream) {
        debug(`replayCredentials: ${socket.id} Replaying credentials for `)
        ssh.stream.write(password + "\n")
      } else {
        console.warn(
          "replayCredentials: Credential replay not allowed for " + socket.id
        )
      }
    }

    /**
     * Handles reauthentication for the socket.
     */
    function handleReauth() {
      debug("handleReauth: Reauthentication requested for " + socket.id)
      if (config.options.allowReauth) {
        clearSessionCredentials()
        debug(`handleReauth: Reauthenticating ${socket.id}`)
        socket.emit("authentication", { action: "reauth" })
        // handleConnectionClose()
      } else {
        console.warn(
          `handleReauth: Reauthentication not allowed for ${socket.id}`
        )
      }
    }

    /**
     * Handles errors in the WebSSH2 application.
     *
     * @param {string} context - The context in which the error occurred.
     * @param {Error} err - The error object.
     */
    function handleError(context, err) {
      var errorMessage = err ? ": " + err.message : ""
      debug("WebSSH2 error: " + context + errorMessage)
      socket.emit("ssherror", "SSH " + context + errorMessage)
      handleConnectionClose()
    }

    /**
     * Updates the specified element with the given value.
     *
     * @param {string} element - The element to update.
     * @param {any} value - The value to set for the element.
     * @returns {void}
     */
    function updateElement(element, value) {
      debug(
        "updateElement: " +
          socket.id +
          ", Element: " +
          element +
          ", Value: " +
          value
      )
      socket.emit("updateUI", { element: element, value: value })
    }

    /**
     * Handles the closure of a connection.
     *
     * @param {string} reason - The reason for the closure.
     */
    function handleConnectionClose(reason) {
      debug("handleDisconnect: " + socket.id + ", Reason: " + reason)
      debug("handleConnectionClose: " + socket.id)
      if (ssh) {
        ssh.end()
      }
      socket.disconnect(true)
    }

    /**
     * Clears the session credentials for the current socket.
     */
    function clearSessionCredentials() {
      debug(
        "clearSessionCredentials: Clearing session credentials for " + socket.id
      )
      if (socket.handshake.session.sshCredentials) {
        socket.handshake.session.sshCredentials.username = null
        socket.handshake.session.sshCredentials.password = null
      }
      socket.handshake.session.usedBasicAuth = false
      sessionState.authenticated = false
      sessionState.username = null
      sessionState.password = null
      socket.handshake.session.save(function (err) {
        if (err) {
          console.error("Failed to save session for " + socket.id + ":", err)
        }
      })
    }

    // Check for HTTP Basic Auth credentials
    if (socket.handshake.session.usedBasicAuth && socket.handshake.session.sshCredentials) {
    // if (socket.handshake.session.sshCredentials) {
      var creds = socket.handshake.session.sshCredentials
      debug(
        "handleConnection: " +
          socket.id +
          ", Host: " +
          creds.host +
          ": HTTP Basic Credentials Exist, creds: %O",
        sanitizeObject(creds)
      )
      handleAuthenticate(creds)
    } else if (!sessionState.authenticated) {
      debug("handleConnection: " + socket.id + ", emitting request_auth")
      socket.emit("authentication", { action: "request_auth" })
    }

    socket.on("authenticate", handleAuthenticate)
    socket.on("terminal", handleTerminal)
    socket.on("disconnect", handleConnectionClose)
  })
}

/**
 * Checks if the provided credentials object is valid.
 *
 * @param {Object} creds - The credentials object.
 * @param {string} creds.username - The username.
 * @param {string} creds.password - The password.
 * @param {string} creds.host - The host.
 * @param {number} creds.port - The port.
 * @returns {boolean} - Returns true if the credentials are valid, otherwise false.
 */
function isValidCredentials(creds) {
  return (
    creds &&
    typeof creds.username === "string" &&
    typeof creds.password === "string" &&
    typeof creds.host === "string" &&
    typeof creds.port === "number"
  )
}
