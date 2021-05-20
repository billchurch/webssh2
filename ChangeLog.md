# Change Log

## 0.5.0 [TBD]
### BREAKING
- Debug environment for webssh2 changed from `WebSSH2` to `webssh2`
### Changes
- Credentials are now retreived using passport.js (should make it easier to expand to other methods in the future) for #247
- Refactored ./app/server/app.js 
  - Safe shutdown feature moved to ./app/server/safeShutdown.js and re-worked
  - Session setup moved out of `/ssh/host` route into ./app/server/sessionSetup.js for readability and reuse for #247
### Added
- New route `/ssh/login/host` to gather `username` and `password` credentials from either GET or POST 

## 0.4.0 [20210519]
### BREAKING
- Disabled ssh.serverlog.client option, this disables the POC which allowed for logging of the data sent between the client/server to the console.log. 
- Dropping support for node versions under 14
### Changes
- Removed HTML menu code from ./app/server/socket.js, the menu is now fully laid out in the ./app/client/src/index.html and the option elements are hidden by default. Not sure why it wasn't done this way from the start, but there it is.
- Updated socket.io to v4.1.1
- Client javascript `./app/client/src/js/index.ts` is now built on TypeScript (`npm run build` will generate javascript for client and place into `app/client/public/webssh2.bundle.js` as before)
- Build environment changes
  - removed unused xterm-addon-search, xterm-addon-weblinks, standard, postcss-discard-comments
  - added prettier 2.3.0, typescript modules, socket.io-client 4.1.1, airbnb linting tools
### Added
- Lookup ip address for hostname in URL, fixes #199 thanks to @zwiy
- Ability to override `Authorization: Basic` header and replace with credentials specified in `config.json` fixes #243. New config.json option `user.overridebasic`
### CONTRIBUTING
In this release, we're trying our best to conform to the [Airbnb Javascript Style Guide](https://airbnb.io/projects/javascript/). I'm hoping this will make contributions easier and keep the code readable. I love shortcuts more than anyone but I've found when making changes to code I've not looked at in a while, it can take me a few momements to deconstruct what was being done due to readbility issues. While I don't agree with every decision in the style guide (semi-colons, yuk), it is a good base to keep the code consistent.

If you've not used it before, I recommend installing the [vscode extensions](https://blog.echobind.com/integrating-prettier-eslint-airbnb-style-guide-in-vscode-47f07b5d7d6a) for that and [Prettier](https://prettier.io/) and getting familiar. The autocorrections are great (especially if you hate dealing with semi-colons...)

As of 0.4.0-testing-0, the client code is written in [TypeScript](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html). It's not that much different from JavaScript, and the introduction strong typing will ultimately help to produce better code. Eventually we want to move the whole project to TypeScript but that make take a bit more time. Take a moment to look at ./app/client/src/js/index.ts to see what TypeScript looks like.
## 0.3.1 [20210513]
### BREAKING
- Ability to configure CORS settings for socket.io see [#240](../../issues/240) for more information on how this may break existing deployments. Default settings in example `config.json` are currently permissive `http.origins: ["*:*"]` please note that if a `config.json` is not present, the default is `http.origins: ["localhost:2222"]
### Added
- Safe Shutdown Feature - thanks to @edgarogh
  - Sending SIGINT or SIGTERM to node process responsible for WebSSH2 or Docker process will result in a "safe" shutdown
  - Timer is configured in config.safeShutdownDuration
- feat: Use docker build to create multi-arch images (#202)
### Fixed
- obey host ssh.host in config fixes #190
### Changed
- `config.json.sample`: `allowreauth` now defaults to `false` fixes #238
- update ssh2 to 0.8.8 -> 0.8.9 - [comparison at ssh2 repo](https://github.com/mscdex/ssh2/compare/v0.8.8...v0.8.9)
- update xterm to 4.12.0 [comparison at xtermjs repo](https://github.com/xtermjs/xterm.js/compare/4.4.0...4.12.0)
- update read-config-ng to 3.0.2
- update morgan to 1.10.0
- update debug to 4.3.1
- update express-session to 1.17.1
- update validator to 13.6.0
- development tools updates (build environment requires minimum of Node 10, only needed for customization)
  - update @fortawesome/fontawesome-svg-core to 1.2.35
  - update @fortawesome/free-solid-svg-icons to 5.15.3
  - update copy-webpack-plugin to 8.1.1
  - update cross-env to 7.0.3
  - update css-loader to 5.2.4
  - update file-loader to 6.2.0
  - update mini-css-extract-plugin to 1.6.0
  - update postcss-discard-comments to 5.0.0
  - update snazzy to 9.0.0
  - update standard to 16.0.3
  - update standard-version to 9.3.0
  - update style-loader to 2.0.0
  - update terser-webpack-plugin to 5.1.1
  - update url-loader to 4.1.1
  - update webpack to 5.37.0
  - update webpack-cli to 4.7.0
  - update webpack-merge to 5.7.3
  - update webpack-stream to 6.1.2
  - update xterm-addon-fit to 0.5.0
  - update xterm-addon-search to 0.8.0
  - update xterm-addon-web-links to 0.4.0
  - update ssri from 6.0.1 to 6.0.2 [#233](../../pull/233)
  - update hosted-git-info from 2.8.5 to 2.8.9 [#237](../../pull/237)
  - update lodash from 4.17.19 to 4.17.21 [#236](../../pull/236)
  - update handlebars from 4.7.6 to 4.7.7 [#235](../../pull/235)
  - update y18n from 4.0.0 to 4.0.1 [#230](../../pull/230)
  - update elliptic from 6.5.3 to 6.5.4 [#228](../../pull/222833)
  - update ini from 1.3.5 to 1.3.8 [#217](../../pull/217)
## 0.3.0 [20200315]
🍀🍀🍀
### Added
- Add configuration option to restrict connections to specified subnets thanks to @Mierdin
- favicon
  - added module `serve-favicon` to serve favicon from root if pre-fetched by browser
  - added `link rel=icon` line in client.htm to serve favico.ico out of /ssh/

### Changed
- Using new repo for read-config -> read-config-ng-
- removed express compression feature, added no real value.
- module updates
  - ssh2 to 0.8.6 -> 0.8.8 - [comparison at ssh2 repo](https://github.com/mscdex/ssh2/compare/v0.8.6...v0.8.8)
  - xterm 4.2.0 -> 4.4.0 - [comparison at xtermjs repo](https://github.com/xtermjs/xterm.js/compare/4.2.0...4.4.0)
  - read-config-ng 3.0.1 - (taking over abandoned repo)n
- development module updates (does not impact production, only for development and rebuilding)
  - fortawesome/fontawesome-svg-core 1.2.27
  - fortawesome/free-solid-svg-icons 5.12.1
  - standard-version 7.1.0
  - webpack 4.42.0
    - webpack-cli 3.3.11
    - terser-webpack-plugin 2.3.5
    - copy-webpack-plugin 5.1.1
    - cross-env 7.0.2
    - css-loader 3.4.2
    - file-loader 5.1.0
    - style-loader 1.1.3
    - url-loader 3.0.0

### Potentially Breaking Changes
- Move all child resources to start from under /ssh
  - /socket.io -> /ssh/socket.io
  - /webssh2.css -> /ssh/webssh2.css
  - /webssh2.bundle.js -> /ssh/webssh2.bundle.js
  - /reauth -> /ssh/reauth
  - perhaps more

### Fixes
- Typo in config.json.sample, thanks @wuchihsu, fixes #173

### Housekeeping
- Removed irrelavant build scripts from /scripts

## 0.2.9 [2019-06-13]
### Changes
- Missing require('fs') in `server/app.js` See issue [#135](../../issues/135)
- Patched read-config to mitigate vulnerability in js-yaml
  - issue not exploitable on webssh2 implementation
  - patched anyway
  - sending my patch upstream to read-config, webssh2 package.json points to patched version in my repository https://github.com/billchurch/nodejs-read-config
  - See https://github.com/nodeca/js-yaml/issues/475 for more detail

## 0.2.8 [2019-05-25]
### Changes
- Fixes issue if no password is entered, browser must be closed and restart to attempt to re-auth. See issue [#118](../../issues/118). Thanks @smilesm2 for the idea.
- fixes broken `npm run (build|builddev)`
  - update font-awesome fonts to 5.6.3
  - update webpack and dependancies
  - update xterm to 3.8.0

### Fixes
- ILX workspace may not always import properly due to symbolic links (specifically ./node_modules/.bin). This is removed from the ILX package

## 0.2.7 [2018-11-11]
### Changes
- `config.reauth` was not respected if initial auth presented was incorrect, regardless of `reauth` setting in `config.json` reauth would always be attempted. fixes [#117](../../issues/117) 
- **BREAKING** moved app files to /app, this may be a breaking change
- Updated dockerfile for new app path
- Updated app dependancies
  - xterm v3.8.0
    - https://github.com/xtermjs/xterm.js/releases/tag/3.8.0
  - basic-auth v2.0.1
    - https://github.com/jshttp/basic-auth/releases/tag/v2.0.1
  - express v4.16.4
    - https://github.com/expressjs/express/releases/tag/4.16.4
  - validator v10.9.0
    - https://github.com/chriso/validator.js/releases/tag/10.9.0
- Updated dev dependancies
  - snazzy v8.0.0 
  - standard v12.0.1 
  - uglifyjs-webpack-plugin v2.0.1 
  - ajv v6.5.5 
  - copy-webpack-plugin v4.6.0 
  - css-loader v1.0.1 
  - nodemon v1.18.6 
  - postcss-discard-comments v4.0.1 
  - snyk v1.108.2 
  - url-loader v1.1.2 
  - webpack v4.25.1 
  - webpack-cli v3.1.2 

## 0.2.6 [2018-11-09]
### Changes
- Reauth didn't work if intial auth presented was incorrect, (see issue #112) fixed thanks @vvalchev
- Update node version supported to >=6 (PR #115) thanks @perlun
- Update packages
  - developer dependencies

## 0.2.5 [2018-09-11]
### Added
- Reauth function thanks to @vbeskrovny and @vvalchev (9bbc116)
  - Controlled by `config.json` option `options.allowreauth` true presents reauth dialog and false hides dialog

### Changed
- `options.challengeButton` enabled
  - previously this configuration option did nothing, this now enables the Credentials button site-wide regardless of the `allowreplay` header value
- Updated debug module to v4

## 0.2.4 [2018-07-18]
### Added
- Browser title window now changes with xterm escape sequences (see http://tldp.org/HOWTO/Xterm-Title-3.html)
- Added bellStyle options
  - `GET var`: **bellStyle** - _string_ - Style of terminal bell: ("sound"|"none"). **Default:** "sound". **Enforced Values:** "sound "none"
  - `config.json`: **terminal.bellStyle** - _string_ - Style of terminal bell: (sound|none). **Default:** "sound".
  - `workspace` folder on GITHUB for BIG-IP specific fixes/changes
### Changed
- Updated xterm.js to 3.1.0
  - https://github.com/xtermjs/xterm.js/releases/tag/3.1.0
- Default listen IP in `config.json` changed back to 127.0.0.1 
### Fixed
- ESC]0; is now removed from log files when using the browser-side logging feature

## 0.2.3 unreleased

### Fixed
- ESC]0; is now removed from log files when using the browser-side logging feature

## 0.2.0 [2018-02-10]
Mostly client (browser) related changes in this release

### Added
- Menu system
- Fontawesome icons
- Resizing browser window sends resize events to terminal container as well as SSH session (pty)
- New terminal options (config.json as well as GET vars)
  - terminal.cursorBlink - boolean - Cursor blinks (true), does not (false) Default: true.
  - terminal.scrollback - integer - Lines in the scrollback buffer. Default: 10000.
  - terminal.tabStopWidth - integer - Tab stops at n characters Default: 8.
- New serverside (nodejs) terminal configuration options (cursorBlink, scrollback, tabStopWidth)
- Logging of MRH session (unassigned if not present)
- Express compression feature

### Changed
- Updated xterm.js to 3.0.2
  - See https://github.com/xtermjs/xterm.js/releases/tag/3.0.2
  - See https://github.com/xtermjs/xterm.js/releases/tag/3.0.1
  - See https://github.com/xtermjs/xterm.js/releases/tag/3.0.0
- Moved javascript events out of html into javascript
- Changed asset packaging from grunt to Webpack to be inline with xterm.js direction
- Moved logging and credentials buttons to menu system
- Removed non-minified options (if you need to disable minification, modify webpack scripts and 'npm run build')

### Fixed
- Resolved loss of terminal foucs when interacting with option buttons (Logging, etc...)

## 0.1.4 [2018-01-30]
### Changed
- Moved socket and util out of folders into .js in root.
- added keepaliveInterval and keepaliveCountMax config options

## 0.1.3 [2017-09-28]
### Changed
- Upgrade to debug@3.1 to eliminate ReDoS in %o formatter
- Upgrade Express to 4.15.5 for ReDOS
- Upgrade basic-auth to v2.0
## 0.1.2 [2017-07-31]
### Added
- ssh.readyTimeout option in config.json (time in ms, default 20000, 20sec)
### Changed
- Updated xterm.js to 2.9.2 from 2.6.0
  - See https://github.com/sourcelair/xterm.js/releases/tag/2.9.2
  - See https://github.com/sourcelair/xterm.js/releases/tag/2.9.1
  - See https://github.com/sourcelair/xterm.js/releases/tag/2.9.0
  - See https://github.com/sourcelair/xterm.js/releases/tag/2.8.1
  - See https://github.com/sourcelair/xterm.js/releases/tag/2.8.0
  - See https://github.com/sourcelair/xterm.js/releases/tag/2.7.0
- Updated ssh2 to 0.5.5 to keep current, no fixes impacting WebSSH2
  - ssh-streams to 0.1.19 from 0.1.16
- Updated validator.js to 8.0.0, no fixes impacting WebSSH2
  - https://github.com/chriso/validator.js/releases/tag/8.0.0
- Updated Express to 4.15.4, no fixes impacting WebSSH2
  - https://github.com/expressjs/express/releases/tag/4.15.4
- Updated Express-session to 1.15.5, no fixes impacting WebSSH2
  - https://github.com/expressjs/session/releases/tag/v1.15.5
- Updated Debug to 3.0.0, no fixes impacting WebSSH2
  - https://github.com/visionmedia/debug/releases/tag/3.0.0
- Running in strict mode ('use strict';)


## 0.1.1 [2017-06-03]
### Added
- `serverlog.client` and `serverlog.server` options added to `config.json` to enable logging of client commands to server log (only client portion implemented at this time)
- morgan express middleware for logging
### Changed
- Updated socket.io to 1.7.4
- continued refactoring, breaking up `index.js`
- revised error handling methods
- revised session termination methods
### Fixed
### Removed
- color console decorations from `util/index.js`
- SanatizeHeaders function from `util/index.js`

## 0.1.0 [2017-05-27]
### Added
- This ChangeLog.md file
- Support for UTF-8 characters (thanks @bara666)
- Snyk, Bithound, Travis CI
- Cross platform improvements (path mappings)
- Session fixup between Express and Socket.io
- Session secret settings in `config.json`
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
- moved SSH algorithms to `config.json` and defined as a session variable (..session.ssh.algorithms)
-- prep for future feature to define algorithms in header or some other method to enable separate ciphers per host
- minified and combined all js files to a single js in `./public/webssh2.min.js` also included a sourcemap `./public/webssh2.min.js` which maps to `./public/webssh2.js` for easier troubleshooting.
- combined all css files to a single css in `./public/webssh2.css`
- minified all css files to a single css in `./public/webssh2.min.css`
- copied all unmodified source css and js to /public/src/css and /public/src/js respectively (for troubleshooting/etc)
- sourcemaps of all minified code (in /public/src and /public/src/js)
- renamed `client.htm` to `client-full.htm`
- created `client-min.htm` to serve minified javascript
- if header.text is null in `config.json` and header is not defined as a get parameter the Header will not be displayed. Both of these must be null / undefined and not specified as get parameters.

### Fixed
- Multiple errors may overwrite status bar which would cause confusion as to what originally caused the error. Example, ssh server disconnects which prompts a cascade of events (conn.on('end'), socket.on('disconnect'), conn.on('close')) and the original reason (conn.on('end')) would be lost and the user would erroneously receive a WEBSOCKET error as the last event to fire would be the websocket connection closing from the app.
- ensure ssh session is closed when a browser disconnects from the websocket
- if headerBackground is changed, status background is changed to the same color (typo, fixed)

### Removed
- Express Static References directly to module source directories due to concatenating and minifying js/css

## 0.0.5 - [2017-03-23]
### Added
- Added experimental support for logging (see Readme)

### Fixed
- Terminal geometry now properly fills the browser screen and communicates this to the ssh session. Tested with IE 11 and recent versions of Chrome/Safari/Firefox.

## 0.0.4 - [2017-03-23]
### Added
- Set default terminal to xterm-color
- Mouse event support
- New config option, config.ssh.term to set terminal

### Changed
- Update to Xterm.js 2.4.0
- Minor code formatting cleanup

## 0.0.3 - [2017-02-16]
### Changed
- Update xterm to latest (2.3.0)
### Fixed
- Fixed misspelled config.ssh.port property

## 0.0.2 - [2017-02-01]
### Changed
- Moving terminal emulation to xterm.js
- updating module version dependencies

### Fixed
- Fixed issue with banners not being displayed properly from UNIX hosts when only lf is used

## 0.0.1 - [2016-06-28]
### Added
- Initial proof of concept and release. For historical purposes only.
