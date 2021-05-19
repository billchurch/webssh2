/* jshint esversion: 6, asi: true, node: true */
// util.js

// private
// takes a string, makes it boolean (true if the string is true, false otherwise)
exports.parseBool = function parseBool(str) {
  return str.toLowerCase() === 'true';
};
