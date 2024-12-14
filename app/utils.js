// server
// /app/utils.js
import validator from 'validator'
import Ajv from 'ajv'
import maskObject from 'jsmasker'
import { createNamespacedDebug } from './logger.js'
import { DEFAULTS, MESSAGES } from './constants.js'
import configSchema from './configSchema.js'

const debug = createNamespacedDebug("utils")

/**
 * Deep merges two objects
 * @param {Object} target - The target object to merge into
 * @param {Object} source - The source object to merge from
 * @returns {Object} The merged object
 */
export function deepMerge(target, source) {
  const output = Object.assign({}, target)
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
export function getValidatedHost(host) {
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
export function getValidatedPort(portInput) {
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
 * - privateKey/privateKey (string)
 *
 * @param {Object} creds - The credentials object.
 * @returns {boolean} - Returns true if the credentials are valid, otherwise false.
 */
export function isValidCredentials(creds) {
  const hasRequiredFields = !!(
    creds &&
    typeof creds.username === "string" &&
    typeof creds.host === "string" &&
    typeof creds.port === "number"
  )

  if (!hasRequiredFields) {
    return false
  }

  // Must have either password or privateKey/privateKey
  const hasPassword = typeof creds.password === "string"
  const hasPrivateKey =
    typeof creds.privateKey === "string" || typeof creds.privateKey === "string"

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
export function validateSshTerm(term) {
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
export function validateConfig(config) {
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
export function modifyHtml(html, config) {
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
export function maskSensitiveData(obj, options) {
  const defaultOptions = {}
  debug("maskSensitiveData")

  const maskingOptions = Object.assign({}, defaultOptions, options || {})
  const maskedObject = maskObject(obj, maskingOptions)

  return maskedObject
}

/**
 * Validates and sanitizes environment variable key names
 * @param {string} key - The environment variable key to validate
 * @returns {boolean} - Whether the key is valid
 */
export function isValidEnvKey(key) {
  return /^[A-Z][A-Z0-9_]*$/.test(key)
}

/**
 * Validates and sanitizes environment variable values
 * @param {string} value - The environment variable value to validate
 * @returns {boolean} - Whether the value is valid
 */
export function isValidEnvValue(value) {
  // Disallow special characters that could be used for command injection
  return !/[;&|`$]/.test(value)
}

/**
 * Parses and validates environment variables from URL query string
 * @param {string} envString - The environment string from URL query
 * @returns {Object|null} - Object containing validated env vars or null if invalid
 */
export function parseEnvVars(envString) {
  if (!envString) return null

  const envVars = {}
  const pairs = envString.split(",")

  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i].split(":")
    if (pair.length !== 2) continue

    const key = pair[0].trim()
    const value = pair[1].trim()

    if (isValidEnvKey(key) && isValidEnvValue(value)) {
      envVars[key] = value
    } else {
      debug(`parseEnvVars: Invalid env var pair: ${key}:${value}`)
    }
  }

  return Object.keys(envVars).length > 0 ? envVars : null
}
