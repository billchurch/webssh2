"use strict";
// app/util.js
/* jshint esversion: 6, asi: true, node: true */

// private
require("colors"); // allow for color property extensions in log messages
var debug = require("debug")("WebSSH2");
var Auth = require("basic-auth");

// takes a string, makes it boolean (true if the string is true, false otherwise)
exports.parseBool = function parseBool(str) {
  return str.toLowerCase() === "true";
};
