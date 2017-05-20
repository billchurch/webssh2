var myError = myError

module.exports = function (socket, io) {
  this.SSHerror = function (myFunc, err) {
    myError = (myError) ? myError : ((err) ? err.message:undefined)
    thisError = (myError) ? ': ' + myError : ''
    console.error('SSH ' + myFunc + thisError)
   	socket.emit('ssherror', 'SSH ' + myFunc + thisError)
   	socket.disconnect(true)
  }
}
