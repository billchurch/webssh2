/* jshint esversion: 6, asi: true, node: true */
// util.js

// private
const debug = require('debug')('WebSSH2');
const Auth = require('basic-auth');

let defaultCredentials = { username: null, password: null, privateKey: null };

exports.setDefaultCredentials = function setDefaultCredentials({
  name: username,
  password,
  privateKey,
  overridebasic,
}) {
  defaultCredentials = { username, password, privateKey, overridebasic };
};

exports.basicAuth = function basicAuth(req, res, next) {
  const myAuth = Auth(req);
  // If Authorize: Basic header exists and the password isn't blank
  // AND config.user.overridebasic is false, extract basic credentials
  // from client]
  const { username, password, privateKey, overridebasic } = defaultCredentials;
  if (myAuth && myAuth.pass !== '' && !overridebasic) {
    req.session.username = myAuth.name;
    req.session.userpassword = myAuth.pass;
    debug(`myAuth.name: ${myAuth.name} and password ${myAuth.pass ? 'exists' : 'is blank'}`);
  } else {
    req.session.username = username;
    req.session.userpassword = password;
    req.session.privateKey = privateKey;
  }
  if (!req.session.userpassword && !req.session.privateKey) {
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
