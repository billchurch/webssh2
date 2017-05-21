var debug = require('debug')('WebSSH2')
var myError

module.exports = function (socket, io) {
  this.SSHerror = function (myFunc, err) {
    myError = (myError) || ((err) ? err.message : undefined)
    var thisError = (myError) ? ': ' + myError : ''
    debug('SSH ' + myFunc + thisError)
    socket.emit('ssherror', 'SSH ' + myFunc + thisError)
    socket.disconnect(true)
  }
}
