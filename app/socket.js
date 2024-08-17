// server
// app/socket.js
"use strict"

const createDebug = require("debug")
const { header } = require("./config")
const debug = createDebug("webssh2:socket")
const SSH = require("ssh2").Client
const { sanitizeObject, validateSshTerm } = require("./utils")
const validator = require("validator")

/**
 * Handles WebSocket connections for SSH
 * @param {import('socket.io').Server} io - The Socket.IO server instance
 * @param {Object} config - The configuration object
 */
module.exports = function (io, config) {
  io.on("connection", (socket) => handleConnection(socket, config))
}

/**
 * Handles a new WebSocket connection
 * @param {import('socket.io').Socket} socket - The Socket.IO socket
 * @param {Object} config - The configuration object
 */
function handleConnection(socket, config) {
  let conn = null
  let stream = null
  let sessionState = {
    connected: false,
    authenticated: false,
    host: null,
    port: null,
    username: null,
    password: null,
    term: null,
    cols: null,
    rows: null,
    config: config
  }

  debug(`handleConnection: ${socket.id}, URL: ${socket.handshake.url}`)

  // removeExistingListeners(socket)
  setupInitialSocketListeners(socket, sessionState)

  // Check for HTTP Basic Auth credentials
  if (socket.handshake.session.sshCredentials) {
    const creds = socket.handshake.session.sshCredentials
    debug(
      `handleConnection: ${socket.id}, Host: ${creds.host}: HTTP Basic Credentials Exist, creds: %O`,
      sanitizeObject(creds)
    )
    handleAuthenticate(socket, creds)
    return
  }

  const authenticated = sessionState.authenticated
  if (!authenticated) {
    // Emit an event to the client to request authentication
    debug(`handleConnection: ${socket.id}, emitting request_auth`)
    socket.emit("authentication", { action: "request_auth" })
  }

  /**
   * Sets up initial socket event listeners
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {Object} config - The configuration object
   */
  function setupInitialSocketListeners(socket, sessionState) {
    config = sessionState.config
    debug(`setupInitialSocketListeners: ${socket.id}`)

    socket.on("error", (error) =>
      console.error(`Socket error for ${socket.id}:`, error)
    )

    socket.on("authenticate", (creds) =>
      handleAuthenticate(socket, creds, sessionState)
    )

    socket.on("disconnect", (socket, reason, conn, stream) => {
      handleDisconnect(socket, reason, conn, stream)
    })
  }

  /**
   * Handles authentication attempts
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   *
   * @param {Credentials} creds - The credentials for authentication
   * @param {Object} config - The configuration object
   */
  function handleAuthenticate(socket, creds) {
    const config = sessionState.config
    debug(`handleAuthenticate: ${socket.id}, %O`, sanitizeObject(creds))

    if (isValidCredentials(socket, creds)) {
      creds.term = validateSshTerm(creds.term)
        ? (sessionState.term = creds.term)
        : (sessionState.term = sessionState.config.ssh.term)
      initializeConnection(socket, creds)
      return
    }

    // Handle invalid credentials scenario
    console.warn(`handleAuthenticate: ${socket.id}, CREDENTIALS INVALID`)
    socket.emit("authentication", {
      success: false,
      message: "Invalid credentials format"
    })
  }

  /**
   * Initializes an SSH connection
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {Credentials} creds - The user credentials
   * @param {Object} config - The configuration object
   */
  function initializeConnection(socket, creds) {
    const config = sessionState.config
    debug(
      `initializeConnection: ${socket.id}, INITIALIZING SSH CONNECTION: Host: ${creds.host}, creds: %O`,
      creds
    )
    if (conn) {
      conn.end()
    }

    conn = new SSH()
    socket.on("terminal", (data) => handleTerminal(socket, stream, data))
    socket.emit("getTerminal", true)

    conn.connect(getSSHConfig(creds, config))

    conn.on("ready", () => {
      sessionState.authenticated = true
      sessionState.connected = true
      sessionState.username = creds.username
      sessionState.password = creds.password
      sessionState.host = creds.host
      sessionState.port = creds.port
      debug(
        `initializeConnection: ${socket.id} conn.on ready: Host: ${creds.host}`
      )
      console.log(
        `initializeConnection: ${socket.id} conn.on ready: ${creds.user}@${creds.host}:${creds.port} successfully connected`
      )
      const auth_result = { action: "auth_result", success: true }
      debug(
        `initializeConnection: ${socket.id} conn.on ready: emitting authentication: ${JSON.stringify(auth_result)}`
      )
      socket.emit("authentication", auth_result)

      // Emit consolidated permissions
      const permissions = {
        autoLog: config.options.autoLog || false,
        allowReplay: config.options.allowReplay || false,
        allowReconnect: config.options.allowReconnect || false,
        allowReauth: config.options.allowReauth || false
      }
      debug(
        `initializeConnection: ${socket.id} conn.on ready: emitting permissions: ${JSON.stringify(permissions)}`
      )
      socket.emit("permissions", permissions)

      updateElement(socket, "footer", `ssh://${creds.host}:${creds.port}`)

      if (config.header && config.header.text !== null) {
        debug(`initializeConnection header: ${config.header}`)
        updateElement(socket, "header", config.header.text)
      }
      setupSSHListeners(socket)
      initializeShell(socket)
    })

    conn.on("error", (err) => {
      console.error(
        `initializeConnection: SSH CONNECTION ERROR: ${socket.id}, Host: ${creds.host}, Error: ${err.message}`
      )
      if (err.level === "client-authentication") {
        socket.emit("authentication", {
          action: "auth_result",
          success: false,
          message: "Authentication failed"
        })
      } else {
        handleError(socket, "SSH CONNECTION ERROR", err)
      }
    })
  }

  /**
   * Sets up SSH-specific event listeners
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {Credentials} creds - The user credentials
   */
  function setupSSHListeners(socket) {
    conn.on("banner", (data) => handleBanner(socket, data))
    conn.on("end", () => handleSSHEnd(socket))
    conn.on("close", () => handleSSHClose(socket))

    socket.on("data", (data) => handleSocketData(socket, stream, data))
    socket.on("resize", (data) => handleResize(stream, data))
    socket.on("control", (data) => handleControl(socket, stream, data))
  }

  /**
   * Initializes the SSH shell
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {Credentials} creds - The user credentials
   */
  function initializeShell(socket) {
    debug(
      `initializeShell: ${socket.id}, sessionState: %O`,
      sanitizeObject(sessionState)
    )
    const { term, cols, rows } = sessionState

    conn.shell(
      {
        term: term,
        cols: cols,
        rows: rows
      },
      (err, str) => {
        if (err) {
          return handleError(socket, "EXEC ERROR", err)
        }
        stream = str

        setupStreamListeners(stream, socket)
      }
    )
  }

  /**
   * Sets up listeners for a stream.
   *
   * @param {Stream} stream - The stream object to listen to.
   * @param {Socket} socket - The socket object associated with the stream.
   */
  function setupStreamListeners(stream, socket) {
    debug(`setupStreamListeners: ${socket.id}`)
    stream.on("data", (data) => handleStreamData(socket, stream, data))
    stream.on("close", (code, signal) =>
      handleStreamClose(stream, socket, code, signal)
    )
    stream.stderr.on("data", (data) => debug("STDERR: " + data))
  }

  /**
   * Handles the close event of a stream.
   *
   * @param {Stream} stream - The stream object.
   * @param {Socket} socket - The socket object.
   * @param {number} code - The code associated with the close event.
   * @param {string} signal - The signal associated with the close event.
   */
  function handleStreamClose(stream, socket, code, signal) {
    debug(`handleStreamClose: ${socket.id}`)
    handleError(socket, "STREAM CLOSE", {
      message: code || signal ? `CODE: ${code} SIGNAL: ${signal}` : undefined
    })
  }

  /**
   * Handles the stream data received from the socket.
   *
   * @param {Socket} socket - The socket object.
   * @param {Stream} stream - The stream object.
   * @param {Buffer} data - The data received from the stream.
   * @returns {void}
   */
  function handleStreamData(socket, stream, data) {
    const connected = sessionState.connected
    socket.emit("data", data.toString("utf-8"))
    if (socket && connected) {
      try {
        socket.write(data)
      } catch (error) {
        console.error(
          "handleStreamData: Error writing to socket:",
          error.message
        )
        // todo: close stream like in handleSocketData?
      }
      return
    }
    console.warn("handleStreamData: Attempted to write to closed socket")
  }

  /**
   * Handles the 'banner' event of the SSH connection
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {string} data - The banner data
   */
  function handleBanner(socket, data) {
    // todo: sanitize the data
    socket.emit("data", data.replace(/\r?\n/g, "\r\n"))
  }

  /**
   * Handles the SSH connection end event
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   */
  function handleSSHEnd(socket) {
    debug(`handleSSHEnd: ${socket.id}`)
    handleConnectionClose(socket)
  }

  /**
   * Handles the SSH connection close event
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   */
  function handleSSHClose(socket) {
    debug(`handleSSHClose: ${socket.id}`)
    handleConnectionClose(socket)
  }

  /**
   * Handles the closure of the SSH connection
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   */
  function handleConnectionClose(socket) {
    debug(`handleConnectionClose: ${socket.id}`)
    sessionState.connected = false
    if (stream) {
      stream.end()
      stream = null
    }
    if (conn) {
      conn.end()
      conn = null
    }
  }

  /**
   * Handles socket disconnection
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {string} reason - The reason for disconnection
   */
  function handleDisconnect(socket, reason, conn, stream) {
    debug(`handleDisconnect: ${socket.id}, Reason: ${reason}`)
    debug(`handleDisconnect: Socket state: $(socket.conn.transport.readyState)`)
    if (conn) {
      conn.end()
      conn = null
    }
    if (stream) {
      stream.end()
      stream = null
    }

    handleConnectionClose(socket)
  }

  /**
   * Handles incoming data from the client
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {import('ssh2').Channel} stream - The SSH stream
   * @param {string} data - The incoming data
   */
  function handleSocketData(socket, stream, data) {
    const connected = sessionState.connected
    if (stream && connected) {
      try {
        stream.write(data)
      } catch (error) {
        console.error(
          "handleSocketData: Error writing to stream:",
          error.message
        )
        handleConnectionClose(socket)
      }
      return
    }
    console.warn("handleSocketData: Attempted to write to closed stream")
    socket.emit("connection_closed")
  }

  /**
   * Handles terminal resize events
   * @param {import('ssh2').Channel} stream - The SSH stream
   * @param {Object} data - The resize data
   * @param {number} data.rows - The number of rows
   * @param {number} data.cols - The number of columns
   */
  function handleResize(stream, data) {
    const { rows, cols } = data
    if (stream) {
      debug(`Resizing terminal to ${rows}x${cols}`)
      sessionState.rows = rows
      sessionState.cols = cols
      stream.setWindow(rows, cols)
      return
    }
    console.warn("handleResize: Attempted to resize closed connection")
  }

  /**
   * Handles control commands from the client
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {import('ssh2').Channel} stream - The SSH stream
   * @param {string} data - The control command
   */
  function handleControl(socket, stream, data) {
    debug(`handleControl: Received control data: ${data}`)
    if (data === "replayCredentials" && stream) {
      replayCredentials(socket, stream)
    } else if (data === "reauth") {
      handleReauth(socket)
    }
  }

  function handleTerminal(socket, conn, data) {
    debug(`handleTerminal: Received terminal data: ${JSON.stringify(data)}`)
    const { term, rows, cols } = data
    if (term != null && validateSshTerm(term)) {
      sessionState.term = term
      debug(`handleTerminal: Set term to ${sessionState.term}`)
    }
    
    if (rows != null && validator.isInt(rows.toString())) {
      sessionState.rows = parseInt(rows, 10)
      debug(`handleTerminal: Set rows to ${sessionState.rows}`)
    }
    
    if (cols != null && validator.isInt(cols.toString())) {
      sessionState.cols = parseInt(cols, 10)
      debug(`handleTerminal: Set cols to ${sessionState.cols}`)
    }
  }

  /**
   * Replays the user credentials to the SSH stream
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {import('ssh2').Channel} stream - The SSH stream
   * @param {Credentials} credentials - The user credentials
   * @param {Object} config - The configuration object
   */
  function replayCredentials(socket, stream) {
    const password = sessionState.password
    const allowReplay = sessionState.config.options.allowReplay || false

    if (allowReplay) {
      debug(`replayCredentials: Replaying credentials for ${socket.id}`)
      stream.write(password + "\n")
    } else {
      // todo: add a warning message to the client
      console.warn(
        `replayCredentials: Credential replay not allowed for ${socket.id}`
      )
    }
  }

  /**
   * Handles reauthentication request
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   */
  function handleReauth(socket) {
    debug(`handleReauth: Reauthentication requested for ${socket.id}`)
    if (config.options.allowReauth) {
      clearSessionCredentials(socket)
      debug(`handleReauth: Reauthenticating ${socket.id}`)
      socket.emit("authentication", { action: "reauth" })
      handleConnectionClose(socket)
    } else {
      // todo: add a warning message to the client
      console.warn(
        `handleReauth: Reauthentication not allowed for ${socket.id}`
      )
    }
  }

  /**
   * Handles SSH errors
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {string} context - The context where the error occurred
   * @param {Error} [err] - The error object
   */
  function handleError(socket, context, err) {
    const errorMessage = err ? `: ${err.message}` : ""
    debug(`WebSSH2 error: ${context}${errorMessage}`)
    socket.emit("ssherror", `SSH ${context}${errorMessage}`)
    handleConnectionClose(socket)
  }

  /**
   * Updates the specified element with the given value by emitting an "updateUI" event through the socket.
   *
   * @param {Socket} socket - The socket object used for communication.
   * @param {string} element - The element to be updated.
   * @param {string} value - The value to update the element with.
   */
  function updateElement(socket, element, value) {
    debug(`updateElement: ${socket.id}, Element: ${element}, Value: ${value}`)
    socket.emit("updateUI", { element, value })
  }

  /**
   * Validates the provided credentials and logs the result
   * @param {Object} socket - The socket object containing the socket ID
   * @param {Object} creds - The credentials to validate
   * @returns {boolean} Whether the credentials are valid
   */
  function isValidCredentials(socket, creds) {
    // Basic format validation
    const isValid =
      creds &&
      typeof creds.username === "string" &&
      typeof creds.password === "string" &&
      typeof creds.host === "string" &&
      typeof creds.port === "number"

    // Single line debug log with ternary operator
    debug(
      `isValidCredentials: ${socket.id}, CREDENTIALS ${isValid ? "VALID" : "INVALID"}: ${socket.id}${
        isValid ? `, Host: ${creds.host}` : ""
      }`
    )

    return isValid
  }

  /**
   * Generates the SSH configuration object
   * @param {Credentials} credentials - The user credentials
   * @param {Object} config - The configuration object
   * @returns {import('ssh2').ConnectConfig} The SSH configuration object
   */
  function getSSHConfig(creds, config) {
    debug(`getSSHConfig: ${socket.id}, creds: %O`, sanitizeObject(creds))

    const sshConfig = {
      host: creds.host,
      port: creds.port,
      username: creds.username,
      password: creds.password,
      tryKeyboard: true,
      algorithms: creds.algorithms || config.ssh.algorithms,
      readyTimeout: creds.readyTimeout || config.ssh.readyTimeout,
      keepaliveInterval:
        creds.keepaliveInterval || config.ssh.keepaliveInterval,
      keepaliveCountMax:
        creds.keepaliveCountMax || config.ssh.keepaliveCountMax,
      debug: createDebug("ssh")
    }
    debug(
      `getSSHConfig:  ${socket.id}, sshConfig: %O`,
      sanitizeObject(sshConfig)
    )
    return sshConfig
  }

  /**
   * Clears the session credentials for a given socket.
   *
   * @param {Socket} socket - The socket object.
   * @returns {void}
   */
  function clearSessionCredentials(socket) {
    debug(
      `clearSessionCredentials: Clearing session credentials for ${socket.id}`
    )
    if (socket.handshake.session.sshCredentials) {
      socket.handshake.session.sshCredentials.username = null
      socket.handshake.session.sshCredentials.password = null
    }
    sessionState.authenticated = false
    sessionState.username = null
    sessionState.password = null
    socket.handshake.session.save((err) => {
      if (err) {
        console.error(`Failed to save session for ${socket.id}:`, err)
      }
    })
  }
}
