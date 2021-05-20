// safeShutdown.js

// safe shutdown
let shutdownMode = false;
let shutdownInterval = 0;
// eslint-disable-next-line consistent-return
exports.safeShutdownGuard = (req, res, next) => {
  if (shutdownMode) {
    res.status(503).end('Service unavailable: Server shutting down');
  } else {
    return next();
  }
};
// clean stop
const stopApp = (io, server, reason) => {
  shutdownMode = false;
  // eslint-disable-next-line no-console
  if (reason) console.log(`Stopping: ${reason}`);
  if (shutdownInterval) clearInterval(shutdownInterval);
  return process.exit(0);
};

exports.doShutdown = (io, server, config) => {
  if (shutdownMode) stopApp(io, server, 'Safe shutdown aborted, force quitting');
  else if (io.of('/').sockets.size > 0) {
    let remainingSeconds = config.safeShutdownDuration;
    shutdownMode = true;
    const message =
      io.of('/').sockets.size === 1 ? ' client is still connected' : ' clients are still connected';
    console.error(io.of('/').sockets.size + message);
    console.error(`Starting a ${remainingSeconds} seconds countdown`);
    console.error('Press Ctrl+C again to force quit');

    shutdownInterval = setInterval(() => {
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        console.error('shutdown remaining seconds 0');
        stopApp('Countdown is over');
      } else {
        io.sockets.emit('shutdownCountdownUpdate', remainingSeconds);
      }
    }, 1000);
  } else stopApp(io, server);
};

exports.stopApp = stopApp;
exports.shutdownMode = shutdownMode;
