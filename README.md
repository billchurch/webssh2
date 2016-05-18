# WebSSH2
Web SSH Client using ssh2, socket.io, term.js, and express

Bare bones example of using SSH2 as a client on a host to proxy a Websocket / Socket.io connection to a SSH2 server. 

# Instructions
To install, copy to a location somewhere and 'npm install'

Edit index.js to change the listener to something (maybe I'll make this CLI arguments at some point?)

Fire up a browser, navigate to IP/port of your choice and specify a host:

http://localhost:2222/?host=192.168.1.1

You will be prompted for credentials to use on the SSH server via HTTP Basic authentcaiton. This is to permit usage with some SSO systems that can replay credentials over HTTP basic.

# Options (GET request vars)
host= - ip or host name of SSH server to connect to (reqired) 
port= - port of SSH server (defaults to 22)
header= - optional header to display on page
headerBackground= - optional background color of header to display on page 

Example:

http://localhost:2222/?host=192.168.1.1&port=2244&header=My%20Header&color=red

# 

