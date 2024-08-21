// server
// /app/utils.js
const validator = require("validator")
const createDebug = require("debug")
const crypto = require("crypto")

const debug = createDebug("webssh2:utils")

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

exports.validateSshTerm = validateSshTerm
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
exports.deepMerge = deepMerge
/**
 * Generates a secure random session secret
 * @returns {string} A random 32-byte hex string
 */
function generateSecureSecret() {
  return crypto.randomBytes(32).toString("hex")
}
exports.generateSecureSecret = generateSecureSecret
