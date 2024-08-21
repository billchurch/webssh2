// server
// /app/utils.js
const validator = require("validator")
const crypto = require("crypto")
const { createNamespacedDebug } = require("./logger")
const { DEFAULTS } = require("./constants")

const debug = createNamespacedDebug("utils")

/**
 * Deep merges two objects
 * @param {Object} target - The target object to merge into
 * @param {Object} source - The source object to merge from
 * @returns {Object} The merged object
 */
function deepMerge(target, source) {
  const output = Object.assign({}, target) // Avoid mutating target directly
  Object.keys(source).forEach(key => {
    if (Object.hasOwnProperty.call(source, key)) {
      if (
        source[key] instanceof Object &&
        !Array.isArray(source[key]) &&
        source[key] !== null
      ) {
        output[key] = deepMerge(output[key] || {}, source[key])
      } else {
        output[key] = source[key]
      }
    }
  })
  return output
}

/**
 * Generates a secure random session secret
 * @returns {string} A random 32-byte hex string
 */
function generateSecureSecret() {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Determines if a given host is an IP address or a hostname.
 * If it's a hostname, it escapes it for safety.
 *
 * @param {string} host - The host string to validate and escape.
 * @returns {string} - The original IP or escaped hostname.
 */
function getValidatedHost(host) {
  let validatedHost

  if (validator.isIP(host)) {
    validatedHost = host
  } else {
    validatedHost = validator.escape(host)
  }

  return validatedHost
}

/**
 * Validates and sanitizes a port value.
 * If no port is provided, defaults to port 22.
 * If a port is provided, checks if it is a valid port number (1-65535).
 * If the port is invalid, defaults to port 22.
 *
 * @param {string} [portInput] - The port string to validate and parse.
 * @returns {number} - The validated port number.
 */
function getValidatedPort(portInput) {
  const defaultPort = DEFAULTS.SSH_PORT
  const port = defaultPort
  debug("getValidatedPort: input: %O", portInput)

  if (portInput) {
    if (validator.isInt(portInput, { min: 1, max: 65535 })) {
      return parseInt(portInput, 10)
    }
  }
  debug(
    "getValidatedPort: port not specified or is invalid, setting port to: %O",
    port
  )

  return port
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

/**
 * Validates and sanitizes the SSH terminal name using validator functions.
 * Allows alphanumeric characters, hyphens, and periods.
 * Returns null if the terminal name is invalid or not provided.
 *
 * @param {string} [term] - The terminal name to validate.
 * @returns {string|null} - The sanitized terminal name if valid, null otherwise.
 */
function validateSshTerm(term) {
  debug(`validateSshTerm: %O`, term)

  if (!term) {
    return null
  }

  const validatedSshTerm =
    validator.isLength(term, { min: 1, max: 30 }) &&
    validator.matches(term, /^[a-zA-Z0-9.-]+$/)

  return validatedSshTerm ? term : null
}

module.exports = {
  deepMerge,
  generateSecureSecret,
  getValidatedHost,
  getValidatedPort,
  isValidCredentials,
  validateSshTerm
}
