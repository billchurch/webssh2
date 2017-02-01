# WebSSH2
Web SSH Client using ssh2, socket.io, xterm.js, and express

Bare bones example of using SSH2 as a client on a host to proxy a Websocket / Socket.io connection to a SSH2 server. 

<img width="1044" alt="screenshot 2016-05-18 13 29 53" src="https://cloud.githubusercontent.com/assets/1668075/15368633/d2c9c4ca-1cfc-11e6-9961-b5b52a07b9ff.png">

# Instructions
To install, copy to a location somewhere and 'npm install'

Edit config.json to change the listener to your liking. There are also some default options which may be definied for a few of the variables.

Fire up a browser, navigate to IP/port of your choice and specify a host (https isn't used here because it's assumed it will be off-loaded to
some sort of proxy):

http://localhost:2222/ssh/host/127.0.0.1

You will be prompted for credentials to use on the SSH server via HTTP Basic authentcaiton. This is to permit usage with some SSO systems that can replay credentials over HTTP basic.

# Options (GET request vars)

port= - port of SSH server (defaults to 22)

header= - optional header to display on page

headerBackground= - optional background color of header to display on page 

# Example:

http://localhost:2222/ssh/host/192.168.1.1?port=2244&header=My%20Header&color=red

