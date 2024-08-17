// server
// /app/utils.js
const validator = require("validator")
const createDebug = require("debug")
const debug = createDebug("webssh2:utils")

/**
 * Sanitizes an object by replacing sensitive properties with asterisks.
 * @param {Object} obj - The object to sanitize.
 * @param {Array} [properties=['password', 'key', 'secret', 'token']] - The list of properties to sanitize.
 * @returns {Object} - The sanitized object.
 */
function sanitizeObject(
  obj,
  properties = ["password", "key", "secret", "token"]
) {
  if (obj && typeof obj === "object") {
    const copy = Array.isArray(obj) ? [] : Object.assign({}, obj)

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // eslint-disable-line no-prototype-builtins
        if (properties.includes(key) && typeof obj[key] === "string") {
          copy[key] = "*".repeat(obj[key].length)
        } else if (typeof obj[key] === "object") {
          copy[key] = sanitizeObject(obj[key], properties)
        } else {
          copy[key] = obj[key]
        }
      }
    }

    return copy
  }

  return obj
}

/**
 * Validates the SSH terminal name using validator functions.
 * Allows alphanumeric characters, hyphens, and periods.
 * @param {string} term - The terminal name to validate
 * @returns {boolean} True if the terminal name is valid, false otherwise
 */
function validateSshTerm(term) {
  debug(`validateSshTerm: %O`, term)

  if (term === undefined || term === null) {
    return false
  }
  return (
    validator.isLength(term, { min: 1, max: 30 }) &&
    validator.matches(term, /^[a-zA-Z0-9.-]+$/)
  )
}

exports.sanitizeObject = sanitizeObject
exports.validateSshTerm = validateSshTerm
