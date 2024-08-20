// server
// /app/utils.js
const validator = require("validator")
const createDebug = require("debug")
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
