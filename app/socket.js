// server
// app/socket.js
"use strict"

const createDebug = require("debug")
const { header } = require("./config")
const debug = createDebug("webssh2:socket")
const SSH = require("ssh2").Client

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
  let authenticated = false
  let isConnectionClosed = false

  debug(`CONNECT: ${socket.id}, URL: ${socket.handshake.url}`)

  removeExistingListeners(socket)
  setupInitialSocketListeners(socket, config)

  if (socket.handshake.session.sshCredentials) {
    const creds = socket.handshake.session.sshCredentials
    const { username, password, host, port } = creds
    debug(`Credentials from session: ${socket.id}, Host: ${host}`, creds)

    if (username && password && host && port) {
      handleAuthentication(socket, creds, config)
      return
    }
  }

  // Emit an event to the client to request authentication
  if (!authenticated) {
    debug(
      `Requesting authentication for ${socket.id} and authenticated is ${authenticated}`
    )
    socket.emit("authentication", { action: "request_auth" })
  }

  /**
   * Removes existing listeners to prevent duplicates
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   */
  function removeExistingListeners(socket) {
    ;["authenticate", "data", "resize", "disconnect", "control"].forEach(
      (event) => {
        socket.removeAllListeners(event)
      }
    )
  }

  /**
   * Sets up initial socket event listeners
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {Object} config - The configuration object
   */
  function setupInitialSocketListeners(socket, config) {
    socket.on("error", (error) =>
      console.error(`Socket error for ${socket.id}:`, error)
    )
    socket.on("authenticate", (creds) =>
      handleAuthentication(socket, creds, config)
    )
    socket.on("disconnect", (reason) => {
      debug(`Client ${socket.id} disconnected. Reason: ${reason}`)
      debug("Socket state at disconnect:", socket.conn.transport.readyState)
      if (conn) {
        conn.end()
        conn = null
      }
      if (stream) {
        stream.end()
        stream = null
      }
    })
  }

  /**
   * Handles authentication attempts
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   *
   * @param {Credentials} creds - The credentials for authentication
   * @param {Object} config - The configuration object
   */
  function handleAuthentication(socket, creds, config) {
    if (!creds.username && !creds.password) {
      creds.username = sshCredentials.username
      creds.password = sshCredentials.password
      creds.host = sshCredentials.host
      creds.port = sshCredentials.port
    }

    // If reauth, creds from this function should take precedence
    if (creds && isValidCredentials(creds)) {
      // Store new credentials in session, overriding any existing ones
      socket.handshake.session.sshCredentials = {
        username: creds.username,
        password: creds.password,
        host: creds.host,
        port: creds.port
      }

      // Save the session after updating
      socket.handshake.session.save((err) => {
        if (err) {
          console.error(`Failed to save session for ${socket.id}:`, err)
        }
      })

      // Proceed with connection initialization using the new credentials
      initializeConnection(socket, creds, config)
    } else {
      // Handle invalid credentials scenario
      debug(`CREDENTIALS INVALID: ${socket.id}, Host: ${creds.host}`)
      socket.emit("authentication", {
        success: false,
        message: "Invalid credentials format"
      })
    }
  }

  /**
   * Initializes an SSH connection
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {Credentials} creds - The user credentials
   * @param {Object} config - The configuration object
   */
  function initializeConnection(socket, creds, config) {
    debug(`INITIALIZING SSH CONNECTION: ${socket.id}, Host: ${creds.host}`)
    if (conn) {
      conn.end()
    }

    conn = new SSH()

    conn.on("ready", () => {
      authenticated = true
      debug(`SSH CONNECTION READY: ${socket.id}, Host: ${creds.host}`)
      socket.emit("authentication", { action: "auth_result", success: true })

      // Emit consolidated permissions
      socket.emit("permissions", {
        allowReplay: config.options.allowReplay || false,
        allowReauth: config.options.allowReauth || false
      })

      if (config.header && config.header.text !== null) {
        debug("header:", config.header)
        socket.emit(
          "updateUI",
          { header: config.header } || { header: { text: "", background: "" } }
        )
      }

      setupSSHListeners(socket, creds)
      initializeShell(socket, creds)
    })

    conn.on("error", (err) => {
      console.error(
        `SSH CONNECTION ERROR: ${socket.id}, Host: ${creds.host}, Error: ${err.message}`
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

    conn.connect(getSSHConfig(creds, config))
  }

  /**
   * Sets up SSH-specific event listeners
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {Credentials} creds - The user credentials
   */
  function setupSSHListeners(socket, creds) {
    conn.on("banner", (data) => handleBanner(socket, data))
    conn.on("end", () => handleSSHEnd(socket))
    conn.on("close", () => handleSSHClose(socket))

    socket.on("data", (data) => handleData(socket, stream, data))
    socket.on("resize", (data) => handleResize(stream, data))
    socket.on("control", (controlData) =>
      handleControl(socket, stream, creds, controlData, config)
    )
  }

  /**
   * Initializes the SSH shell
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {Credentials} creds - The user credentials
   */
  function initializeShell (socket, creds) {
    conn.shell(
      {
        term: creds.term || 'vt69', // config.ssh.term,
        cols: creds.cols,
        rows: creds.rows
      },
      (err, str) => {
        if (err) {
          return handleError(socket, "EXEC ERROR", err)
        }
        stream = str

        stream.on("data", (data) => socket.emit("data", data.toString("utf-8")))
        stream.on("close", (code, signal) => {
          handleError(socket, "STREAM CLOSE", {
            message:
              code || signal ? `CODE: ${code} SIGNAL: ${signal}` : undefined
          })
        })
        stream.stderr.on("data", (data) => debug("STDERR: " + data))
      }
    )
  }

  /**
   * Handles the 'banner' event of the SSH connection
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {string} data - The banner data
   */
  function handleBanner(socket, data) {
    socket.emit("data", data.replace(/\r?\n/g, "\r\n"))
  }

  /**
   * Handles the SSH connection end event
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   */
  function handleSSHEnd(socket) {
    debug(`SSH CONNECTION ENDED: ${socket.id}`)
    handleConnectionClose(socket)
  }

  /**
   * Handles the SSH connection close event
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   */
  function handleSSHClose(socket) {
    debug(`SSH CONNECTION CLOSED: ${socket.id}`)
    handleConnectionClose(socket)
  }

  /**
   * Handles the closure of the SSH connection
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   */
  function handleConnectionClose(socket) {
    isConnectionClosed = true
    if (stream) {
      stream.end()
      stream = null
    }
    if (conn) {
      conn.end()
      conn = null
    }
    socket.emit("connection_closed")
  }

  /**
   * Handles socket disconnection
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {string} reason - The reason for disconnection
   */
  function handleDisconnect(socket, reason) {
    debug(`DISCONNECT: ${socket.id}, Reason: ${reason}`)
    handleConnectionClose(socket)
  }

  /**
   * Handles incoming data from the client
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {import('ssh2').Channel} stream - The SSH stream
   * @param {string} data - The incoming data
   */
  function handleData(socket, stream, data) {
    if (stream && !isConnectionClosed) {
      try {
        stream.write(data)
      } catch (error) {
        debug("Error writing to stream:", error.message)
        handleConnectionClose(socket)
      }
    } else if (isConnectionClosed) {
      debug("Attempted to write to closed connection")
      socket.emit("connection_closed")
    }
  }

  /**
   * Handles terminal resize events
   * @param {import('ssh2').Channel} stream - The SSH stream
   * @param {Object} data - The resize data
   * @param {number} data.rows - The number of rows
   * @param {number} data.cols - The number of columns
   */
  function handleResize(stream, data) {
    if (stream) {
      stream.setWindow(data.rows, data.cols)
    }
  }

  /**
   * Handles control commands from the client
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {import('ssh2').Channel} stream - The SSH stream
   * @param {Credentials} credentials - The user credentials
   * @param {string} controlData - The control command
   * @param {Object} config - The configuration object
   */
  function handleControl(socket, stream, creds, controlData, config) {
    debug(`Received control data: ${controlData}`)

    if (controlData === "replayCredentials" && stream && creds) {
      replayCredentials(socket, stream, creds, config)
    } else if (controlData === "reauth" && config.options.allowReauth) {
      handleReauth(socket)
    }
  }

  /**
   * Replays the user credentials to the SSH stream
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   * @param {import('ssh2').Channel} stream - The SSH stream
   * @param {Credentials} credentials - The user credentials
   * @param {Object} config - The configuration object
   */
  function replayCredentials(socket, stream, credentials, config) {
    let allowReplay = config.options.allowReplay || false

    if (allowReplay) {
      debug(`Replaying credentials for ${socket.id}`)
      stream.write(credentials.password + "\n")
    } else {
      debug(`Credential replay not allowed for ${socket.id}`)
    }
  }

  /**
   * Handles reauthentication request
   * @param {import('socket.io').Socket} socket - The Socket.IO socket
   */
  function handleReauth(socket) {
    debug(`Reauthentication requested for ${socket.id}`)

    // Clear existing session credentials
    socket.handshake.session.sshCredentials = null

    // Save the session after modification
    socket.handshake.session.save((err) => {
      if (err) {
        console.error(`Failed to save session for ${socket.id}:`, err)
      }

      // Notify client to reauthenticate
      socket.emit("authentication", { action: "reauth" })

      // Close the current connection to enforce reauthentication
      handleConnectionClose(socket)
    })
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
   * Validates the provided credentials
   * @param {Credentials} credentials - The credentials to validate
   * @returns {boolean} Whether the credentials are valid
   */
  function isValidCredentials(credentials) {
    // Basic format validation
    return (
      credentials &&
      typeof credentials.username === "string" &&
      typeof credentials.password === "string" &&
      typeof credentials.host === "string" &&
      typeof credentials.port === "number"
    )
  }

  /**
   * Generates the SSH configuration object
   * @param {Credentials} credentials - The user credentials
   * @param {Object} config - The configuration object
   * @returns {import('ssh2').ConnectConfig} The SSH configuration object
   */
  function getSSHConfig(credentials, config) {
    return {
      host: credentials.host,
      port: credentials.port,
      username: credentials.username,
      password: credentials.password,
      tryKeyboard: true,
      algorithms: credentials.algorithms,
      readyTimeout: credentials.readyTimeout,
      keepaliveInterval: credentials.keepaliveInterval,
      keepaliveCountMax: credentials.keepaliveCountMax,
      debug: createDebug("ssh")
    }
  }
}
