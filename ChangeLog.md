# Change Log
## [0.1.0] 2017-05-27
### Added
- This ChangeLog.md file
- Support for UTF-8 characters (thanks @bara666)
- Snyk, Bithound, Travis CI
- Cross platform improvements (path mappings)
- Session fixup between Express and Socket.io
- Session secret settings in config.json
- env variable `DEBUG=ssh2` will put the `ssh2` module into debug mode
- env variable `DEBUG=WebSSH2` will output additional debug messages for functions
and events in the application (not including the ssh2 module debug)
- using Grunt to pull js and css source files from other modules `npm run build` to rebuild these if changed or updated.
- `useminified` option in `config.json` to enable using minified client side javascript (true) defaults to false (non-minified)
- sshterm= query option to specify TERM environment variable for host, valid strings are alpha-numeric with a hypen (validated). Otherwise the default ssh.term variable from `config.json` will be used.
- validation for host (v4,v6,fqdn,hostname), port (integer 2-65535), and header (sanitized) from URL input

### Changed
- error handling in public/client.js
- moved socket.io operations to their own file /socket/index.js, more changes like this to come (./socket/index.js)
- all session based variables are now under the req.session.ssh property or socket.request.ssh (./index.js)
- moved SSH algorithms to config.json and defined as a session variable (..session.ssh.algorithms)
-- prep for future feature to define algorithms in header or some other method to enable separate ciphers per host
- minified and combined all js files to a single js in `./public/webssh2.min.js` also included a sourcemap `./public/webssh2.min.js` which maps to `./public/webssh2.js` for easier troubleshooting.
- combined all css files to a single css in `./public/webssh2.css`
- minified all css files to a single css in `./public/webssh2.min.css`
- copied all unmodified source css and js to /public/src/css and /public/src/js respectively (for troubleshooting/etc)
- sourcemaps of all minified code (in /public/src and /public/src/js)
- renamed `client.htm` to `client-full.htm`
- created `client-min.htm` to serve minified javascript
- if header.text is null in config.json and header is not defined as a get parameter the Header will not be displayed. Both of these must be null / undefined and not specified as get parameters.

### Fixed
- Multiple errors may overwrite status bar which would cause confusion as to what originally caused the error. Example, ssh server disconnects which prompts a cascade of events (conn.on('end'), socket.on('disconnect'), conn.on('close')) and the original reason (conn.on('end')) would be lost and the user would erroneously receive a WEBSOCKET error as the last event to fire would be the websocket connection closing from the app.
- ensure ssh session is closed when a browser disconnects from the websocket
- if headerBackground is changed, status background is changed to the same color (typo, fixed)

### Removed
- Express Static References directly to module source directories due to concatenating and minifying js/css

## [0.0.5] - 2017-03-23
### Added
- Added experimental support for logging (see Readme)

### Fixed
- Terminal geometry now properly fills the browser screen and communicates this to the ssh session. Tested with IE 11 and recent versions of Chrome/Safari/Firefox.

## [0.0.4] - 2017-03-23
### Added
- Set default terminal to xterm-color
- Mouse event support
- New config option, config.ssh.term to set terminal

### Changed
- Update to Xterm.js 2.4.0
- Minor code formatting cleanup

## [0.0.3] - 2017-02-16
### Changed
- Update xterm to latest (2.3.0)
### Fixed
- Fixed misspelled config.ssh.port property

## [0.0.2] - 2017-02-01
### Changed
- Moving terminal emulation to xterm.js
- updating module version dependencies

### Fixed
- Fixed issue with banners not being displayed properly from UNIX hosts when only lf is used

## [0.0.1] - 2016-06-28
### Added
- Initial proof of concept and release. For historical purposes only.
