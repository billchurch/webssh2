# WebSSH2
Web SSH Client using ssh2, socket.io, xterm.js, and express

Bare bones example of using SSH2 as a client on a host to proxy a Websocket / Socket.io connection to a SSH2 server. 

<img width="1044" alt="screenshot 2016-05-18 13 29 53" src="https://cloud.githubusercontent.com/assets/1668075/15368633/d2c9c4ca-1cfc-11e6-9961-b5b52a07b9ff.png">

# Instructions
To install:

1. Clone to a location somewhere and `npm install`

2. If desired, edit config.json to change the listener to your liking. There are also some default options which may be definied for a few of the variables.

3. Run `npm start`

4. Fire up a browser, navigate to IP/port of your choice and specify a host (https isn't used here because it's assumed it will be off-loaded to
some sort of proxy):

http://localhost:2222/ssh/host/127.0.0.1

You will be prompted for credentials to use on the SSH server via HTTP Basic authentcaiton. This is to permit usage with some SSO systems that can replay credentials over HTTP basic.

# Options (GET request vars)

port= - port of SSH server (defaults to 22)

header= - optional header to display on page

headerBackground= - optional background color of header to display on page 

# Config File Options
config.json contains several options which may be specified to customize to your needs, vs editing the javascript direclty. This is JSON format so mind your spacing, brackets, etc...

`listen.ip` default `127.0.0.1`
* IP address node should listen on for client connections

`listen.port` default `2222`
* Port node should listen on for client connections

`user.name` default `null`
* Specify user name to authenticate with

`user.password` default `null`
* Specify password to authenticate with

`ssh.host` default `null`
* Specify host to connect to

`ssh.port` default `22`
* Specify SSH port to connect to 

`ssh.term` default `xterm-color`
* Specify terminal emulation to use

`header.text`
* Specify header text, defaults to `My Header` but may also be set to `null`

`header.background`
* Header background, defaults to `green`

`options.challengeButton`
* Challenge button. This option, which is still under development, allows the user to resend the password to the server (in cases of step-up authentication for things like `sudo` or a router `enable` command. 

# Example:

http://localhost:2222/ssh/host/192.168.1.1?port=2244&header=My%20Header&color=red

