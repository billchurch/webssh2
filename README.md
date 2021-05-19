# WebSSH2

<ignorestart>

[![GitHub version](https://badge.fury.io/gh/billchurch%2Fwebssh2.svg)](https://badge.fury.io/gh/billchurch%2Fwebssh2) [![Build Status](https://travis-ci.org/billchurch/webssh2.svg?branch=master)](https://travis-ci.org/billchurch/webssh2)



[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/billchurch)

Web SSH Client using ssh2, socket.io, xterm.js, and express

A bare bones example of an HTML5 web-based terminal emulator and SSH client. We use SSH2 as a client on a host to proxy a Websocket / Socket.io connection to a SSH2 server.

<img width="600" height="340" alt="WebSSH2 v0.2.0 demo" src="https://github.com/billchurch/WebSSH2/raw/master/screenshots/demo-800.gif">

# Requirements
Node v6.x or above. If using <v6.x you should be able to run by replacing the "read-config" package to @1 like this (after a clone):

`npm install --save read-config@1
`

Just keep in mind that there is no intention to ensure compatability with Node < v6.x

# Instructions
To install:

1. Clone to a location somewhere and then `cd app` and `npm install --production`. If you want to develop and rebuild javascript and other files utilize `npm install` instead.

2. If desired, edit app/config.json to change the listener to your liking. There are also some default options which may be definied for a few of the variables.

3. Run `npm start`

4. Fire up a browser, navigate to IP/port of your choice and specify a host (https isn't used here because it's assumed it will be off-loaded to
some sort of proxy):

http://localhost:2222/ssh/host/127.0.0.1

You will be prompted for credentials to use on the SSH server via HTTP Basic authentcaiton. This is to permit usage with some SSO systems that can replay credentials over HTTP basic.

# Customizing client files

See [BUILDING.md](BUILDING.md) for more details.

# Docker Instructions

Copy app/config.json.template to app/config.json and modify the latter:

```js
{
  // ...
  "listen": {
    "ip": "0.0.0.0",
    "port": 2222
  }
  // ...
}
```

Rebuild and run

```bash
docker build -t webssh2 .
docker run --name webssh2 -d -p 2222:2222 webssh2
```

Alternatively if you don't want to rebuild, mount the config at runtime:

```bash
docker run --name webssh2 -d -p 2222:2222 -v `pwd`/app/config.json:/usr/src/config.json webssh2
```

<ignoreend>

# Options

## GET request vars

* **port=** - _integer_ - port of SSH server (defaults to 22)

* **header=** - _string_ - optional header to display on page

* **headerBackground=** - _string_ - optional background color of header to display on page

* **readyTimeout=** - _integer_ - How long (in milliseconds) to wait for the SSH handshake to complete. **Default:** 20000. **Enforced Values:** Min: 1, Max: 300000

* **cursorBlink** - _boolean_ - Cursor blinks (true), does not (false) **Default:** true.

* **scrollback** - _integer_ - Lines in the scrollback buffer. **Default:** 10000. **Enforced Values:** Min: 1, Max: 200000

* **tabStopWidth** - _integer_ - Tab stops at _n_ characters **Default:** 8. **Enforced Values:** Min: 1, Max: 100

* **bellStyle** - _string_ - Style of terminal bell: ("sound"|"none"). **Default:** "sound". **Enforced Values:** "sound", "none"

## Headers

* **allowreplay** - _boolean_ - Allow use of password replay feature, example `allowreplay: true`

* **mrhsession** - _string_ - Can be used to pass APM session for event correlation `mrhsession: abc123`

## Config File Options
`config.json` contains several options which may be specified to customize to your needs, vs editing the javascript directly. This is JSON format so mind your spacing, brackets, etc...

* **listen.ip** - _string_ - IP address node should listen on for client connections, defaults to `127.0.0.1`

* **listen.port** - _integer_ - Port node should listen on for client connections, defaults to `2222`

* **http.origins** - _array_ - COORS origins to allow connections from to socket.io server, defaults to `localhost:2222`. Changed in 0.3.1, to enable previous, less secure, default behavior of everything use `*:*` (not recommended). Check [#240](../../issues/240)

* **user.name** - _string_ - Specify user name to authenticate with. In normal cases this should be left to the default `null` setting.

* **user.password** - _string_ - Specify password to authenticate with. In normal cases this should be left to the default `null` setting.

* **user.overridebasic** - _boolean_ - When set to `true` ignores `Authorization: Basic` header sent from client and use credentials defined in `user.name` and `user.password` instead. Defaults to `false`. [issue 242](../../issues/242) for more information.

* **ssh.host** - _string_ - Specify host to connect to. May be either hostname or IP address. Defaults to `null`.

* **ssh.port** - _integer_ - Specify SSH port to connect to, defaults to `22`

* **ssh.term** - _string_ - Specify terminal emulation to use, defaults to `xterm-color`

* **ssh.readyTimeout** - _integer_ - How long (in milliseconds) to wait for the SSH handshake to complete. **Default:** 20000.

* **ssh.keepaliveInterval** - _integer_ - How often (in milliseconds) to send SSH-level keepalive packets to the server (in a similar way as OpenSSH's ServerAliveInterval config option). Set to 0 to disable. **Default:** 120000.

* **ssh.keepaliveCountMax** - _integer_ - How many consecutive, unanswered SSH-level keepalive packets that can be sent to the server before disconnection (similar to OpenSSH's ServerAliveCountMax config option). **Default:** 10.

* **allowedSubnets** - _array_ - A list of subnets that the server is allowed to connect to via SSH. An empty array means all subnets are permitted; no restriction. **Default:** empty array.

* **terminal.cursorBlink** - _boolean_ - Cursor blinks (true), does not (false) **Default:** true.

* **terminal.scrollback** - _integer_ - Lines in the scrollback buffer. **Default:** 10000.

* **terminal.tabStopWidth** - _integer_ - Tab stops at _n_ characters **Default:** 8.

* **terminal.bellStyle** - _string_ - Style of terminal bell: (sound|none). **Default:** "sound".

* **header.text** - _string_ - Specify header text, defaults to `My Header` but may also be set to `null`. When set to `null` no header bar will be displayed on the client.

* **header.background** - _string_ - Header background, defaults to `green`.

* **session.name** - _string_ - Name of session ID cookie. it's not a horrible idea to make this something unique.

* **session.secret** - _string_ - Secret key for cookie encryption. You should change this in production.

* **options.challengeButton** - _boolean_ - Challenge button. This option, which is still under development, allows the user to resend the password to the server (in cases of step-up authentication for things like `sudo` or a router `enable` command.

* **options.allowreauth** - _boolean_ - Reauth button. This option creates an option to provide a button to create a new session with new credentials. See [issue 51](../../issues/51) and [pull 85](../../pull/85) for more detail.

* **algorithms** - _object_ - This option allows you to explicitly override the default transport layer algorithms used for the connection. Each value must be an array of valid algorithms for that category. The order of the algorithms in the arrays are important, with the most favorable being first. Valid keys:

    * **kex** - _array_ - Key exchange algorithms.

        * Default values:

            1. ecdh-sha2-nistp256 **(node v0.11.14 or newer)**
            2. ecdh-sha2-nistp384 **(node v0.11.14 or newer)**
            3. ecdh-sha2-nistp521 **(node v0.11.14 or newer)**
            4. diffie-hellman-group-exchange-sha256 **(node v0.11.12 or newer)**
            5. diffie-hellman-group14-sha1

        * Supported values:

            * ecdh-sha2-nistp256 **(node v0.11.14 or newer)**
            * ecdh-sha2-nistp384 **(node v0.11.14 or newer)**
            * ecdh-sha2-nistp521 **(node v0.11.14 or newer)**
            * diffie-hellman-group-exchange-sha256 **(node v0.11.12 or newer)**
            * diffie-hellman-group14-sha1
            * diffie-hellman-group-exchange-sha1 **(node v0.11.12 or newer)**
            * diffie-hellman-group1-sha1

    * **cipher** - _array_ - Ciphers.

        * Default values:

            1. aes128-ctr
            2. aes192-ctr
            3. aes256-ctr
            4. aes128-gcm **(node v0.11.12 or newer)**
            5. aes128-gcm@openssh.com **(node v0.11.12 or newer)**
            6. aes256-gcm **(node v0.11.12 or newer)**
            7. aes256-gcm@openssh.com **(node v0.11.12 or newer)**

        * Supported values:

            * aes128-ctr
            * aes192-ctr
            * aes256-ctr
            * aes128-gcm **(node v0.11.12 or newer)**
            * aes128-gcm@openssh.com **(node v0.11.12 or newer)**
            * aes256-gcm **(node v0.11.12 or newer)**
            * aes256-gcm@openssh.com **(node v0.11.12 or newer)**
            * aes256-cbc
            * aes192-cbc
            * aes128-cbc
            * blowfish-cbc
            * 3des-cbc
            * arcfour256
            * arcfour128
            * cast128-cbc
            * arcfour

    * **hmac** - _array_ - (H)MAC algorithms.

        * Default values:

            1. hmac-sha2-256
            2. hmac-sha2-512
            3. hmac-sha1

        * Supported values:

            * hmac-sha2-256
            * hmac-sha2-512
            * hmac-sha1
            * hmac-md5
            * hmac-sha2-256-96
            * hmac-sha2-512-96
            * hmac-ripemd160
            * hmac-sha1-96
            * hmac-md5-96

    * **compress** - _array_ - Compression algorithms.

        * Default values:

            1. none
            2. zlib@openssh.com
            3. zlib

        * Supported values:

            * none
            * zlib@openssh.com
            * zlib

* **serverlog.client** - _boolean_ - Enables client command logging on server log (console.log). Very simple at this point, buffers data from client until it receives a line-feed then dumps buffer to console.log with session information for tracking. Will capture anything send from client, including passwords, so use for testing only... Default: false. Example:
  * _serverlog.client: GcZDThwA4UahDiKO2gkMYd7YPIfVAEFW/mnf0NUugLMFRHhsWAAAA host: 192.168.99.80 command: ls -lat_

* **serverlog.server** - _boolean_ - not implemented, default: false.

* **accesslog** - _boolean_ - http style access logging to console.log, default: false

* **safeShutdownDuration** - _integer_ - maximum delay, in seconds, given to users before the server stops when doing a safe shutdown

# Client-side logging
Clicking `Start logging` on the status bar will log all data to the client. A `Download log` option will appear after starting the logging. You may download at any time to the client. You may stop logging at any time my pressing the `Logging - STOP LOG`. Note that clicking the `Start logging` option again will cause the current log to be overwritten, so be sure to download first.

# Example:

http://localhost:2222/ssh/host/192.168.1.1?port=2244&header=My%20Header&headerBackground=red

# CONTRIBUTING
As of 0.4.0, we're trying our best to conform to the [Airbnb Javascript Style Guide](https://airbnb.io/projects/javascript/). I'm hoping this will make contributions easier and keep the code readable. I love shortcuts more than anyone but I've found when making changes to code I've not looked at in a while, it can take me a few momements to deconstruct what was being done due to readbility issues. While I don't agree with every decision in the style guide (semi-colons, yuk), it is a good base to keep the code consistent.

If you've not used it before, I recommend installing the [vscode extensions](https://blog.echobind.com/integrating-prettier-eslint-airbnb-style-guide-in-vscode-47f07b5d7d6a) for that and [Prettier](https://prettier.io/) and getting familiar. The autocorrections are great (especially if you hate dealing with semi-colons...)

All contributions are welcome, all may not make it into a release... To increase the chances of your contribution making it into a release, try your best to conform to the style guides and targets of the project.

# Tips
* You can enable extended debug messages in the browser Java console using:
  * `localStorage.debug = '*';` - Debug Everything (a lot of messages)
  * `localStorage.debug = 'WebSSH2';` - Debug potentially interesting WebSSH2 related messages (replaying credentials, resizing data, other control messages)
* If you want to add custom JavaScript to the browser client you can either modify `./src/client.html` and add a **\<script\>** element, modify `./src/index.js` directly, or check out `webpack.*.js` and add your custom javascript file to a task there (best option).