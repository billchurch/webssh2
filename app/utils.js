// server
// /app/utils.js

/**
 * Recursively sanitizes an object by replacing the value of any `password`
 * property with asterisks (*) matching the length of the original password.
 *
 * @param {Object} obj - The object to sanitize.
 * @returns {Object} - The sanitized object.
 */
function sanitizeObject(obj) {
  // Check if the input is an object or array
  if (obj && typeof obj === 'object') {
    // Iterate over each key in the object
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) { // eslint-disable-line no-prototype-builtins
        if (key === 'password' && typeof obj[key] === 'string') {
          // Replace password value with asterisks
          obj[key] = '*'.repeat(obj[key].length);
        } else if (typeof obj[key] === 'object') {
          // Recursively sanitize nested objects
          sanitizeObject(obj[key]);
        }
      }
    }
  }
  return obj;
}
exports.sanitizeObject = sanitizeObject;
