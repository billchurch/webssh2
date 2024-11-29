// server
// /app/utils.js
const validator = require("validator")
const Ajv = require("ajv")
const maskObject = require("jsmasker")
const { createNamespacedDebug } = require("./logger")
const { DEFAULTS, MESSAGES } = require("./constants")
const configSchema = require("./configSchema")

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
 * Valid credentials must have:
 * - username (string)
 * - host (string)
 * - port (number)
 * AND either:
 * - password (string) OR
 * - privatekey (string)
 *
 * @param {Object} creds - The credentials object.
 * @param {string} creds.username - The username.
 * @param {string} [creds.password] - The password.
 * @param {string} [creds.privatekey] - The private key.
 * @param {string} creds.host - The host.
 * @param {number} creds.port - The port.
 * @returns {boolean} - Returns true if the credentials are valid, otherwise false.
 */
function isValidCredentials(creds) {
  const hasRequiredFields = !!(
    creds &&
    typeof creds.username === "string" &&
    typeof creds.host === "string" &&
    typeof creds.port === "number"
  )

  if (!hasRequiredFields) {
    return false
  }

  // Must have either password or privatekey
  const hasPassword = typeof creds.password === "string"
  const hasPrivateKey = typeof creds.privatekey === "string"

  return hasPassword || hasPrivateKey
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

/**
 * Validates the given configuration object.
 *
 * @param {Object} config - The configuration object to validate.
 * @throws {Error} If the configuration object fails validation.
 * @returns {Object} The validated configuration object.
 */
function validateConfig(config) {
  const ajv = new Ajv()
  const validate = ajv.compile(configSchema)
  const valid = validate(config)
  if (!valid) {
    throw new Error(
      `${MESSAGES.CONFIG_VALIDATION_ERROR}: ${ajv.errorsText(validate.errors)}`
    )
  }
  return config
}

/**
 * Modify the HTML content by replacing certain placeholders with dynamic values.
 * @param {string} html - The original HTML content.
 * @param {Object} config - The configuration object to inject into the HTML.
 * @returns {string} - The modified HTML content.
 */
function modifyHtml(html, config) {
  debug("modifyHtml")
  const modifiedHtml = html.replace(
    /(src|href)="(?!http|\/\/)/g,
    '$1="/ssh/assets/'
  )

  return modifiedHtml.replace(
    "window.webssh2Config = null;",
    `window.webssh2Config = ${JSON.stringify(config)};`
  )
}

/**
 * Masks sensitive information in an object
 * @param {Object} obj - The object to mask
 * @param {Object} [options] - Optional configuration for masking
 * @param {string[]} [options.properties=['password', 'key', 'secret', 'token']] - The properties to be masked
 * @param {number} [options.maskLength=8] - The length of the generated mask
 * @param {number} [options.minLength=5] - The minimum length of the generated mask
 * @param {number} [options.maxLength=15] - The maximum length of the generated mask
 * @param {string} [options.maskChar='*'] - The character used for masking
 * @param {boolean} [options.fullMask=false] - Whether to use a full mask for all properties
 * @returns {Object} The masked object
 */
function maskSensitiveData(obj, options) {
  const defaultOptions = {}
  debug("maskSensitiveData")

  const maskingOptions = Object.assign({}, defaultOptions, options || {})
  const maskedObject = maskObject(obj, maskingOptions)

  return maskedObject
}

module.exports = {
  deepMerge,
  getValidatedHost,
  getValidatedPort,
  isValidCredentials,
  maskSensitiveData,
  modifyHtml,
  validateConfig,
  validateSshTerm
}
