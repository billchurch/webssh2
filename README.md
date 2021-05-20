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

# Configuration
see [CONFIGURATION](configuration.md)

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