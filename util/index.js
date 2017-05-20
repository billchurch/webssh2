var debug = require('debug')('WebSSH2')
var colors = require('colors')
var Auth = require('basic-auth')

console.warn = makeColorConsole(console.warn, 'yellow')
console.error = makeColorConsole(console.error, 'red')

function makeColorConsole (fct, color) {
  return function () {
    for (var i in arguments) {
      if (arguments[i] instanceof Object) { arguments[i] = sys.inspect(arguments[i]) }
    }
    fct(Array.prototype.join.call(arguments, ' ')[color])
  }
}

exports.basicAuth = function (req, res, next) {
  var myAuth = Auth(req)
  if (myAuth) {
    req.session.username = myAuth.name
    req.session.userpassword = myAuth.pass
    debug('myAuth.name: ' + myAuth.name + ' and password ' + ((myAuth.pass) ? 'exists' : 'is blank'.underline.red))
    next()
  } else {
    res.statusCode = 401
    debug('basicAuth credential request (401)')
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH"')
    res.end('Username and password required for web SSH service.')
  }
}
