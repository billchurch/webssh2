// private
require('colors') // allow for color property extensions in log messages
var debug = require('debug')('WebSSH2')
var Auth = require('basic-auth')
var util = require('util')

console.warn = makeColorConsole(console.warn, 'yellow')
console.error = makeColorConsole(console.error, 'red')

// public
function makeColorConsole (fct, color) {
  return function () {
    for (var i in arguments) {
      if (arguments[i] instanceof Object) { arguments[i] = util.inspect(arguments[i]) }
    }
    fct(Array.prototype.join.call(arguments, ' ')[color])
  }
}

exports.basicAuth = function (req, res, next) {
  var myAuth = Auth(req)
  if (myAuth) {
    req.session.username = myAuth.name
    req.session.userpassword = myAuth.pass
    debug('myAuth.name: ' + myAuth.name.yellow.bold.underline + ' and password ' + ((myAuth.pass) ? 'exists'.yellow.bold.underline : 'is blank'.underline.red.bold))
    next()
  } else {
    res.statusCode = 401
    debug('basicAuth credential request (401)')
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH"')
    res.end('Username and password required for web SSH service.')
  }
}

// expects headers to be a JSON object, will replace authroization header with 'Sanatized//Exists'
// we don't want to log basic auth header since it contains a password...
exports.SanatizeHeaders = function (headers) {
  if (headers.authorization) { headers.authorization = 'Sanitized//Exists' }
  return (headers)
}
