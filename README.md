# WebSSH2 - Web SSH Client

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/billchurch)

WebSSH2 is an HTML5 web-based terminal emulator and SSH client. It uses SSH2 as a client on a host to proxy a Websocket / Socket.io connection to an SSH2 server.

![WebSSH2 v0.2.0 demo](https://github.com/billchurch/WebSSH2/raw/master/screenshots/demo-800.gif)

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Docker Setup](#docker-setup)
- [Usage](#usage)
- [Configuration](#configuration)
- [Routes](#routes)
- [Deprecation Notice](#deprecation-notice)
- [Tips](#tips)

## Requirements

- Node.js 6.9.1

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/billchurch/webssh2.git
   cd webssh2
   ```

2. Install dependencies:
   ```
   npm install --production
   ```
   For development purposes, use `npm install` instead.

3. Configure the application by editing `config.json` if needed.

4. Start the server:
   ```
   npm start
   ```

## Docker Setup

1. Modify `config.json`:
   ```json
   {
     "listen": {
       "ip": "0.0.0.0",
       "port": 2222
     }
   }
   ```

2. Build and run the Docker container:
   ```bash
   docker build -t webssh2 .
   docker run --name webssh2 -d -p 2222:2222 webssh2
   ```

## Usage

Access the web client by navigating to:

```
http://localhost:2222/ssh
```

You'll be prompted for host details and SSH credentials.

Alternatively you may use the `/ssh/host/<host>` route:

```
http://localhost:2222/ssh/host/127.0.0.1
```

You'll be prompted for SSH credentials via HTTP Basic Authentication.

## Configuration

### GET Parameters

- `port=` - _integer_ - SSH server port (default: 22)
- `header=` - _string_ - Optional header text
- `sshTerm=` - _string_ - Terminal type for pty (default: xterm-color)

### Config File Options

Edit `config.json` to customize the following options:

- `listen.ip` - _string_ - IP address to listen on (default: "127.0.0.1")
- `listen.port` - _integer_ - Port to listen on (default: 2222)
- `http.origins` - _array_ - CORS origins for socket.io
- `user.name` - _string_ - Default SSH username (default: null)
- `user.password` - _string_ - Default SSH password (default: null)
- `ssh.host` - _string_ - Default SSH host (default: null)
- `ssh.port` - _integer_ - Default SSH port (default: 22)
- `ssh.term` - _string_ - Terminal emulation (default: "xterm-color")
- `ssh.readyTimeout` - _integer_ - SSH handshake timeout in ms (default: 20000)
- `ssh.keepaliveInterval` - _integer_ - SSH keepalive interval in ms (default: 120000)
- `ssh.keepaliveCountMax` - _integer_ - Max SSH keepalive packets (default: 10)
- `header.text` - _string_ - Header text (default: null)
- `header.background` - _string_ - Header background color (default: "green")
- `session.name` - _string_ - Session cookie name
- `session.secret` - _string_ - Session secret key
- `options.challengeButton` - _boolean_ - Enable challenge button (default: true)
- `options.autoLog` - _boolean_ - Enable auto-logging (default: false)
- `options.allowReauth` - _boolean_ - Allow reauthentication (default: true)
- `options.allowReconnect` - _boolean_ - Allow reconnection (default: true)
- `options.allowReplay` - _boolean_ - Allow credential replay (default: true)

For detailed SSH algorithm configurations, refer to the full config file.

## Routes

WebSSH2 provides two main routes:

### 1. `/ssh`

- **URL:** `http(s)://your-webssh2-server/ssh`
- **Features:** 
  - Interactive login form
    <img width="341" alt="image" src="https://github.com/user-attachments/assets/829d1776-3bc5-4315-b0c6-9e96a648ce06">
  - Terminal configuration options
    <img width="341" alt="image" src="https://github.com/user-attachments/assets/bf60f5ba-7221-4177-8d64-946907aed5ff">

### 2. `/ssh/host/:host`

- **URL:** `http(s)://your-webssh2-server/ssh/host/:host`
- **Authentication:** HTTP Basic Auth
- **Features:** 
  - Quick connections to specific hosts
  - Optional `port` parameter (e.g., `?port=2222`)

## Deprecation Notice

Several configuration options and GET parameters have been deprecated. For a list of removed options and required actions, please refer to [DEPRECATED.md](./DEPRECATED.md).

## Tips

- To add custom JavaScript, modify `./src/client.htm`, `./src/index.js`, or add your file to `webpack.*.js`.
- For security, use HTTPS when transmitting credentials via HTTP Basic Auth.
- Terminal settings for `/ssh/host/:host` can be customized after login via `Menu | Settings` and persist across sessions.

For more detailed information on configuration and usage, please refer to the full documentation or open an issue on GitHub.
