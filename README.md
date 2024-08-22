# WebSSH2 - Web SSH Client

![Orthrus Mascot](images/orthrus.png)

WebSSH2 is an HTML5 web-based terminal emulator and SSH client. It uses SSH2 as a client on a host to proxy a Websocket / Socket.io connection to an SSH2 server.

![WebSSH2 demo](https://user-images.githubusercontent.com/1668075/182425293-acc8741e-cc92-4105-afdc-9538e1685d4b.gif)

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Docker Setup](#docker-setup)
- [Usage](#usage)
- [Configuration](#configuration)
- [Features](#features)
- [Routes](#routes)
- [Deprecation Notice](#deprecation-notice)
- [Tips](#tips)
- [Support](#support)

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

1. Build and run the Docker container (with debug messages):
   ```bash
   docker build -t webssh2 .
   docker run --name webssh2 --rm -it -p 2222:2222 -e "DEBUG=webssh*,-webssh2:ssh2" webssh2
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
P
## Configuration

### GET Parameters

- `port=` - _integer_ - SSH server port (default: `22`)
- `header=` - _string_ - Optional header text
- `headerBackground=` - _string_ - Optional background color (default: `"green"`)
- `sshterm=` - _string_ - Terminal type for pty (default: xterm-color)

### Config File Options

Edit `config.json` to customize the following options:

- `listen.ip` - _string_ - IP address to listen on (default: `"127.0.0.1"`)
- `listen.port` - _integer_ - Port to listen on (default: `2222`)
- `http.origins` - _array_ - CORS origins for socket.io (default: `["*:*"]`)
- `user.name` - _string_ - Default SSH username (default: `null`)
- `user.password` - _string_ - Default SSH password (default: `null`)
- `ssh.host` - _string_ - Default SSH host (default: `null`)
- `ssh.port` - _integer_ - Default SSH port (default: `22`)
- `ssh.term` - _string_ - Terminal emulation (default: `"xterm-color"`)
- `ssh.readyTimeout` - _integer_ - SSH handshake timeout in ms (default: `20000`)
- `ssh.keepaliveInterval` - _integer_ - SSH keepalive interval in ms (default: `120000`)
- `ssh.keepaliveCountMax` - _integer_ - Max SSH keepalive packets (default: `10`)
- `header.text` - _string_ - Header text (default: `null`)
- `header.background` - _string_ - Header background color (default: `"green"`)
- `session.name` - _string_ - Session cookie name (default: `"webssh2.sid"`)
- `session.secret` - _string_ - Session secret key (default: `crypto.randomBytes(32).toString("hex")`)
- `options.challengeButton` - _boolean_ - Enable challenge button (default: `true`)
- `options.autoLog` - _boolean_ - Enable auto-logging (default: `false`)
- `options.allowReauth` - _boolean_ - Allow reauthentication (default: `true`)
- `options.allowReconnect` - _boolean_ - Allow reconnection (default: `true`)
- `options.allowReplay` - _boolean_ - Allow credential replay (default: `true`)

For detailed SSH algorithm configurations, refer to the full config file.

## Features

### Keyboard Interactive Authentication

Keyboard Interactive authentication provides a flexible way to handle various authentication scenarios, including multi-factor authentication.

#### How it works

1. When the SSH server requests Keyboard Interactive authentication, WebSSH2 can handle it in two ways:
   a) Automatically (default behavior)
   b) By prompting the user through the web interface

2. In automatic mode:
   - If all prompts contain the word "password" (case-insensitive), WebSSH2 will automatically respond using the password provided during the initial connection attempt.
   - If any prompt doesn't contain "password", all prompts will be forwarded to the web client for user input.

3. When prompts are sent to the web client:
   - A dialog box appears in the user's browser, displaying all prompts from the SSH server.
   - The user can input responses for each prompt.
   - Responses are sent back to the SSH server to complete the authentication process.

#### Configuration Options

You can customize the Keyboard Interactive authentication behavior using the following option in your `config.json`:

```json
{
  "ssh": {
    "alwaysSendKeyboardInteractivePrompts": false
  }
}
```

- `alwaysSendKeyboardInteractivePrompts` (boolean, default: false):
  - When set to `true`, all Keyboard Interactive prompts will always be sent to the web client, regardless of their content.
  - When set to `false` (default), WebSSH2 will attempt to automatically handle password prompts and only send non-password prompts to the web client.

#### Use Cases

1. **Simple Password Authentication**: 
   With default settings, if the SSH server uses Keyboard Interactive for password authentication, WebSSH2 will automatically handle it without additional user interaction.

2. **Multi-Factor Authentication**: 
   For SSH servers requiring additional factors (e.g., OTP), WebSSH2 will present prompts to the user through the web interface.

3. **Always Prompt User**: 
   By setting `alwaysSendKeyboardInteractivePrompts` to `true`, you can ensure that users always see and respond to all authentication prompts, which can be useful for security-sensitive environments or for debugging purposes.

#### Security Considerations

- The automatic password handling feature is designed for convenience but may not be suitable for high-security environments. Consider setting `alwaysSendKeyboardInteractivePrompts` to `true` if you want users to explicitly enter their credentials for each session.
- Ensure that your WebSSH2 installation uses HTTPS to protect the communication between the web browser and the WebSSH2 server.

For more information on SSH keyboard-interactive authentication, refer to [RFC 4256](https://tools.ietf.org/html/rfc4256).

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
- You can enable debug from the console by passing the `DEBUG` environment variable to your start script: `DEBUG=webssh*,-webssh2:ssh2 npm run start`. The `webssh2:ssh2` namespace is very chatty and shows all of the SSH protocol information, the `-webssh2:ssh2` excludes that namespace from the line above, otherwise `DEBUG=webssh*` will capture all of the WebSSH2 specific bits. You may also debug Socket.IO and Express related events with `engine`, `socket` and `express` namespaces, or go for broke and debug everything with `DEBUG=*`.

For more detailed information on configuration and usage, please refer to the full documentation or open an issue on GitHub.

## Support
If you like what I do, and want to support me you can [buy me a coffee](https://www.buymeacoffee.com/billchurch)!

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/billchurch)