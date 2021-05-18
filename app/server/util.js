/* jshint esversion: 6, asi: true, node: true */
// util.js

// private
require('colors'); // allow for color property extensions in log messages
const debug = require('debug')('WebSSH2');
const Auth = require('basic-auth');

const defaultCredentials = { username: null, password: null, privatekey: null };

exports.setDefaultCredentials = function setDefaultCredentials(
  username,
  password,
  privatekey,
  overridebasic
) {
  defaultCredentials.username = username;
  defaultCredentials.password = password;
  defaultCredentials.privatekey = privatekey;
  defaultCredentials.overridebasic = overridebasic;
};

exports.basicAuth = function basicAuth(req, res, next) {
  const myAuth = Auth(req);
  // If Authorize: Basic header exists and the password isn't blank
  // AND config.user.overridebasic is false, extract basic credentials
  // from client
  if (myAuth && myAuth.pass !== '' && !defaultCredentials.overridebasic) {
    req.session.username = myAuth.name;
    req.session.userpassword = myAuth.pass;
    debug(
      `myAuth.name: ${myAuth.name.yellow.bold.underline} and password ${
        myAuth.pass ? 'exists'.yellow.bold.underline : 'is blank'.underline.red.bold
      }`
    );
  } else {
    req.session.username = defaultCredentials.username;
    req.session.userpassword = defaultCredentials.password;
    req.session.privatekey = defaultCredentials.privatekey;
  }
  if (!req.session.userpassword && !req.session.privatekey) {
    res.statusCode = 401;
    debug('basicAuth credential request (401)');
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH"');
    res.end('Username and password required for web SSH service.');
    return;
  }
  next();
};

// takes a string, makes it boolean (true if the string is true, false otherwise)
exports.parseBool = function parseBool(str) {
  return str.toLowerCase() === 'true';
};
