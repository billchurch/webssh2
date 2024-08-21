// server
// app/constants.js

const path = require("path")

/**
 * Error messages
 */
const MESSAGES = {
  INVALID_CREDENTIALS: "Invalid credentials format",
  SSH_CONNECTION_ERROR: "SSH CONNECTION ERROR",
  SHELL_ERROR: "SHELL ERROR",
  CONFIG_ERROR: "CONFIG_ERROR",
  UNEXPECTED_ERROR: "An unexpected error occurred",
  EXPRESS_APP_CONFIG_ERROR: "Failed to configure Express app",
  CLIENT_FILE_ERROR: "Error loading client file",
  FAILED_SESSION_SAVE: "Failed to save session",
  CONFIG_VALIDATION_ERROR: "Config validation error"
}

/**
 * Default values
 */
const DEFAULTS = {
  SSH_PORT: 22,
  LISTEN_PORT: 2222,
  SSH_TERM: "xterm-color",
  IO_PING_TIMEOUT: 60000, // 1 minute
  IO_PING_INTERVAL: 25000, // 25 seconds
  IO_PATH: "/ssh/socket.io",
  WEBSSH2_CLIENT_PATH: path.resolve(
    __dirname,
    "..",
    "node_modules",
    "webssh2_client",
    "client",
    "public"
  ),
  CLIENT_FILE: "client.htm"
}

/**
 * HTTP Related
 */
const HTTP = {
  OK: 200,
  UNAUTHORIZED: 401,
  INTERNAL_SERVER_ERROR: 500,
  AUTHENTICATE: "WWW-Authenticate",
  REALM: 'Basic realm="WebSSH2"',
  AUTH_REQUIRED: "Authentication required.",
  COOKIE: "basicauth",
  PATH: "/ssh/host/",
  SAMESITE: "Strict",
  SESSION_SID: "webssh2_sid",
  CREDS_CLEARED: "Credentials cleared.",
}

module.exports = {
  MESSAGES,
  DEFAULTS,
  HTTP
}
