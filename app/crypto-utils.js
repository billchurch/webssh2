// server
// app/crypto-utils.js

const crypto = require("crypto")

/**
 * Generates a secure random session secret
 * @returns {string} A random 32-byte hex string
 */
function generateSecureSecret() {
  return crypto.randomBytes(32).toString("hex")
}

module.exports = {
  generateSecureSecret
}
