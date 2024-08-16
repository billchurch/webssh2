// server
// /app/utils.js

/**
 * Recursively sanitizes a copy of an object by replacing the value of any `password`
 * property with asterisks (*) matching the length of the original password.
 *
 * @param {Object} obj - The object to sanitize.
 * @returns {Object} - The sanitized copy of the object.
 */
function sanitizeObject(obj) {
  if (obj && typeof obj === 'object') {
    const copy = Array.isArray(obj) ? [] : Object.assign({}, obj);
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) { // eslint-disable-line no-prototype-builtins
        if (key === 'password' && typeof obj[key] === 'string') {
          copy[key] = '*'.repeat(obj[key].length);
        } else if (typeof obj[key] === 'object') {
          copy[key] = sanitizeObject(obj[key]);
        } else {
          copy[key] = obj[key];
        }
      }
    }

    return copy;
  }

  return obj;
}
exports.sanitizeObject = sanitizeObject;
