// server
// /app/utils.js

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

exports.sanitizeObject = sanitizeObject
