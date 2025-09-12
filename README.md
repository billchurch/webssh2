# WebSSH2 - Web SSH Client

[![Contributors Guide](https://img.shields.io/badge/Contributors-Guide-blue?logo=github)](./CONTRIBUTORS.md)

![Orthrus Mascot](images/orthrus2.png)

WebSSH2 is an HTML5 web-based terminal emulator and SSH client. It uses SSH2 as a client on a host to proxy a Websocket / Socket.io connection to an SSH2 server.

![WebSSH2 Screenshot](images/Screenshot.png)

## Table of Contents

- [Requirements](#requirements)
- [Breaking Changes](#breaking-changes)
- [Installation](#installation)
- [Docker Setup](#docker-setup)
- [Usage](#usage)
- [Configuration](#configuration)
- [Environment Variables via URL](#environment-variables-via-url)
- [E2E SSH Test](./DOCS/E2E-SSH.md)
- [Features](#features)
- [Exec Channel](#exec-channel)
- [Constants Overview](./DOCS/CONSTANTS.md)
- [Routes](#routes)
- [Client-Side Module](#client-side-module)
- [Tips](#tips)
- [Support](#support)
- [Contributors Guide](./CONTRIBUTORS.md)

## Requirements

- Node.js 22 LTS (Jod)

## Breaking Changes

- See [CONFIG.md](./DOCS/CONFIG.md) for a list of breaking changes to the config.json file.
- See [DEPRECATED.md](./DOCS/DEPRECATED.md) for a list of deprecated options.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/billchurch/webssh2.git
   cd webssh2
   ```

2. Install dependencies:

   ```bash
   npm install --production
   ```

   For development purposes, use `npm install` instead.

3. Configure the application by editing `config.json` if needed.

4. Start the server:

   ```bash
   npm start
   ```

## Docker Setup

Prefer configuring WebSSH2 via environment variables (12‑factor). See DOCS/ENV_VARIABLES.md for the full list. Below are common examples.

1) Build and run (with debug):

```bash
docker build -t webssh2 .
docker run --name webssh2 --rm -it \
  -p 2222:2222 \
  -e DEBUG="webssh2*,-webssh2:ssh2" \
  -e WEBSSH2_LISTEN_PORT=2222 \
  -e WEBSSH2_HTTP_ORIGINS="*:*" \
  -e WEBSSH2_SSH_HOST=ssh.example.com \
  -e WEBSSH2_SSH_PORT=22 \
  -e WEBSSH2_HEADER_TEXT="WebSSH2" \
  webssh2
```

2) With algorithm preset and SSO headers (example):

```bash
docker run --name webssh2 --rm -it \
  -p 2222:2222 \
  -e WEBSSH2_SSH_ALGORITHMS_PRESET=modern \
  -e WEBSSH2_SSO_ENABLED=false \
  -e WEBSSH2_OPTIONS_ALLOW_RECONNECT=true \
  webssh2
```

3) Optional: using a config.json

Environment variables take precedence. If you still need a config file, mount it at `/usr/src/app/config.json`:

```bash
docker run --name webssh2 --rm -it \
  -p 2222:2222 \
  -e DEBUG="webssh2*" \
  -v "$(pwd)/config.json:/usr/src/app/config.json" \
  webssh2
```

Notes:

- If you previously mounted to `/usr/src/config.json`, it will not be detected.
- The default configuration provides basic functionality; prefer env vars for overrides.

## Usage

Access the web client by navigating to:

```bash
http://localhost:2222/ssh
```

You'll be prompted for host details and SSH credentials.

Alternatively you may use the `/ssh/host/<host>` route:

```bash
http://localhost:2222/ssh/host/127.0.0.1
```

You'll be prompted for SSH credentials via HTTP Basic Authentication.
P

## Configuration

### GET Parameters (URL)

These query parameters can be used with `/ssh` or `/ssh/host/...` routes:

- `port` – integer SSH port (default 22)
- `sshterm` – terminal type (default xterm-color)
- `header` – header text override
- `headerBackground` – header background color (default "green")
- `headerStyle` – additional inline styles (e.g., `color: red`)
- `env` – comma-separated env pairs for SSH session (e.g., `FOO:bar,BAR:baz`)

Notes:

- Use `&env=...` when appending to an existing query string (not a second `?`).
- SSH server must allow names via `AcceptEnv`. See the “Environment Variables via URL” section for details.

### Server Configuration (preferred: environment variables)

- Preferred: See DOCS/ENV_VARIABLES.md for the full list of `WEBSSH2_*` variables with types and examples.
- Alternative: See DOCS/CONFIG.md for `config.json` structure if you need file-based config.

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

### SSH Private Key Authentication

WebSSH2 supports SSH private key authentication when using the `/ssh/host/` endpoint with a private key configured in the server settings or via the interactive method with the `/ssh/` endpoint.

### Exec Channel

WebSSH2 supports non-interactive command execution over SSH using the SSH2 exec channel, in addition to the interactive shell.

- When clients emit an `exec` request, the server executes the provided command and streams output back to the client.
- This feature is additive and does not change the existing interactive shell flow.

WebSocket events (server API additions):

- Client → Server: `exec`
  - Payload:
    - `command` (string, required): command to execute
    - `pty` (boolean, optional): request a PTY for the exec channel
    - `term`, `cols`, `rows` (optional): PTY settings; defaults to session values
    - `env` (object, optional): environment variables to merge with session env
    - `timeoutMs` (number, optional): kill/terminate exec if exceeded
- Server → Client: `exec-data`
  - Payload: `{ type: 'stdout' | 'stderr', data: string }`
- Server → Client: `exec-exit`
  - Payload: `{ code: number|null, signal: string|null }`

Compatibility and behavior:

- Stdout is sent on both the existing `data` event and `exec-data` with `type: 'stdout'` for backward compatibility with terminal sinks.
- Stderr is sent only via `exec-data` with `type: 'stderr'` to avoid polluting legacy terminal output handlers.
- The SSH connection remains open after command completion so multiple execs can reuse a single session.

Security notes:

- Exec requests respect the same SSH authentication and authorization as shells.
- You can provide environment variables via query (`env=FOO:bar,BAZ:qux`) which are applied to both shell and exec sessions.

#### Exec Troubleshooting

- PTY for TUIs: Interactive full‑screen apps (e.g., `mc`, `htop`, `sudo`) typically require a TTY. Clients should set `pty: true` in the `exec` payload, and forward stdin and terminal resize events while the command runs.
- Mouse inputs print escapes: This happens when the client does not forward raw stdin to the server or no PTY is allocated. Ensure the client requests `pty: true` and forwards `data` (stdin) and `resize` events during exec. The official CLI forwards both when `--pty` is used.
- TERM/terminfo mismatches: If keys or line‑drawing characters look wrong, try a simpler terminal type (`term: "xterm"`), or ensure the remote host has a terminfo entry for your TERM (`infocmp $TERM`).
- Dimensions and resizing: Exec PTY sizing uses `cols/rows` from the session (or the exec payload). Clients should emit `resize` during exec so the server calls `setWindow` on the exec stream.
- No live output: Non‑PTY exec may buffer output until completion. Use `pty: true` for interactive, incremental output.
- Timeout behavior: If the client sets `timeoutMs`, the server attempts to signal/close the exec stream and emits `exec-exit` with `{ code: null, signal: 'TIMEOUT' }`.
- Exit codes: The server emits `exec-exit` with the remote exit `code` (and `signal` when applicable). Clients can map this directly to their process exit status.

Example (Socket.IO payload):

```js
// Client → Server
socket.emit('exec', {
  command: 'htop',
  pty: true,
  term: 'xterm-256color',
  cols: 120,
  rows: 40,
  env: { FOO: 'bar' },
  timeoutMs: 30000
})

// Server → Client
socket.on('exec-data', ({ type, data }) => {
  if (type === 'stdout') process.stdout.write(data)
  else process.stderr.write(data)
})
socket.on('exec-exit', ({ code, signal }) => {
  console.log('exit:', code, signal)
})
```

#### Configuration

Private key authentication can be configured through the `config.json` file for use with the `/ssh/host/` endpoints:

```json
{
  "user": {
    "name": "myuser",
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nYour-Private-Key-Here\n-----END RSA PRIVATE KEY-----",
    "passphrase": "passphrase-for-encrypted-key",
    "password": "optional-fallback-password"
  }
}
```

Note: The `/ssh` endpoint also supports private key authentication through the interactive web interface, where users can paste or upload their private keys directly.

#### Key Requirements

- Only `ssh-rsa` type keys are supported
- Passphrase encryption is supported, and if used the `passphrase` must be provided
- The private key must be in PEM format
- The key in `config.json` must be on a single line with `\n` as line separators
- Must include the appropriate header and footer:

  ```bash
  -----BEGIN RSA PRIVATE KEY-----\n[... key content ...]\n-----END RSA PRIVATE KEY-----
  ```

  or for encrypted keys:

  ```bash
  -----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,5930F19760F7FBBC865400940A89D954\n\n[... key content ...]\n-----END RSA PRIVATE KEY-----
  ```

#### Generating a Private Key

To generate a new SSH private key, you can use the following command:

```bash
ssh-keygen -m PEM -t rsa -b 4096 -f ~/.ssh/id_rsa
```

#### Converting Your Private Key

Keys uploaded or pasted using the interactive mode through the `/ssh` endpoint can work as-is, however if using a key with `config.json` you must convert your existing SSH private key into the correct format (single line). A bash one-liner you can to accomplish this is:

```bash
echo '    "privateKey": "'$(cat ~/.ssh/id_rsa | tr '\n' '~' | sed 's/~/\\n/g')'"'
```

This command:

1. Reads your private key file
2. Converts newlines to temporary characters
3. Replaces those characters with `\n`
4. Wraps the result in quotes
5. Outputs the key in a format ready to paste into your `config.json`

#### Authentication Process

1. When connecting through the `/ssh/host/` endpoint, WebSSH2 will first attempt to authenticate using the private key specified in `config.json`
2. If key authentication fails and `user.password` is configured, the system will automatically attempt password authentication
3. If both authentication methods fail, you'll receive an authentication error

#### Endpoint Support

- `/ssh/host/:host` - Supports private key authentication configured via `config.json`
- `/ssh` - Supports private key authentication via interactive web interface (users can provide keys directly)

#### Security Considerations

- Store private keys securely in your server configuration
- Use appropriate file permissions for your `config.json` file
- Consider using encrypted private keys for additional security
- Always use HTTPS when accessing the WebSSH2 service

#### Example Usage

1. Convert and configure your private key:

   ```bash
   # First, convert your key
   echo '"'$(cat ~/.ssh/id_rsa | tr '\n' '~' | sed 's/~/\\n/g')'"'
   
   # Copy the output and paste it into config.json
   ```

2. Configure `config.json`:

   ```json
   {
     "user": {
       "name": "myuser",
       "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpA...[rest of key]...Yh5Q==\n-----END RSA PRIVATE KEY-----",
       "passphrase": "your-passphrase-here",
       "password": "fallback-password"
     }
   }
   ```

3. Access the service via the `/ssh/host/` endpoint:

   ```
   https://your-server:2222/ssh/host/target-server
   ```

#### Troubleshooting

If key authentication fails, check:

- Key type is `ssh-rsa`
- Key format in `config.json` is properly escaped with `\n` line separators
- Key permissions on the target SSH server
- Server's `authorized_keys` file configuration
- SSH server logs for specific authentication failure reasons

For additional support or troubleshooting, please open an issue on the GitHub repository.

### Environment Variables via URL

WebSSH2 supports passing environment variables through URL parameters, allowing you to customize the SSH session environment. This feature enables scenarios like automatically opening specific files or setting custom environment variables.

Quick examples (both routes supported):

- Without auto-connect (login form):
  - `/ssh?env=FOO:bar,BAR:baz`
- With auto-connect (host in URL):
  - `/ssh/host/localhost?port=2244&env=FOO:bar,BAR:baz`

Tips:

- Use `&env=...` when adding to an existing query string; do not add a second `?`.
- Your SSH server must also allow each variable name via `AcceptEnv` in `sshd_config`.
- You can restrict which variables are forwarded using an allowlist (see “Security Considerations” below).

#### Server Configuration

Before using this feature, you must configure your SSH server to accept the environment variables you want to pass. Edit your `/etc/ssh/sshd_config` file to include the desired variables in the `AcceptEnv` directive:

```bash
# Allow client to pass locale environment variables and custom vars
AcceptEnv LANG LC_* VIM_FILE CUSTOM_ENV
```

Remember to restart your SSH server after making changes:

```bash
sudo systemctl restart sshd  # For systemd-based systems
# or
sudo service sshd restart   # For init.d-based systems
```

#### Usage

Pass environment variables using the `env` query parameter:

```bash
# Single environment variable
http://localhost:2222/ssh/host/example.com?env=VIM_FILE:config.txt

# Multiple environment variables
http://localhost:2222/ssh/host/example.com?env=VIM_FILE:config.txt,CUSTOM_ENV:test

# Also works on /ssh (without auto-connect)
http://localhost:2222/ssh?env=VIM_FILE:config.txt,CUSTOM_ENV:test
```

#### Security Considerations

To maintain security, environment variables must meet these criteria:

- Variable names must:
  - Start with a capital letter
  - Contain only uppercase letters, numbers, and underscores (`^[A-Z][A-Z0-9_]*$`)
  - Be listed in the SSH server's `AcceptEnv` directive
- Variable values cannot contain shell special characters (`;`, `&`, `|`, `` ` ``, `$`).
- Server-side filtering and limits:
  - WebSSH2 filters any keys that do not match the format above.
  - You can restrict which keys are allowed using an allowlist.
  - Caps: up to 50 key/value pairs; key length ≤ 32; value length ≤ 512.

Invalid or disallowed variables are ignored.

Allowlist options:

- Config file: `ssh.envAllowlist: ["FOO", "BAR"]`
- Environment variable: `WEBSSH2_SSH_ENV_ALLOWLIST="FOO,BAR"` or JSON `'["FOO","BAR"]'`

When an allowlist is provided, only listed keys are forwarded to the SSH session (after format/value checks).

#### Troubleshooting: AcceptEnv on SSH server

If variables aren’t visible on the remote host after connecting:

- Ensure `AcceptEnv` in `/etc/ssh/sshd_config` includes each name (e.g., `AcceptEnv FOO BAR`).
- Restart or reload SSHD after changes: `sudo systemctl reload sshd` (or `restart`).
- Check server logs in debug mode; you should see `req env` lines. If a name is denied, OpenSSH logs e.g. `Ignoring env request BAR: disallowed name`.
- Some distributions or `Match` blocks override `AcceptEnv`. Verify no later directives disable it.
- Confirm your client URL uses `&env=...` (not a second `?`).
- With an allowlist configured (`ssh.envAllowlist` or `WEBSSH2_SSH_ENV_ALLOWLIST`), only listed names are forwarded by WebSSH2.

#### Example Usage

1. Configure your SSH server as shown above.

2. Create a URL with environment variables:

   ```
   http://localhost:2222/ssh/host/example.com?env=VIM_FILE:settings.conf,CUSTOM_ENV:production
   ```

3. In your remote server's `.bashrc` or shell initialization file:

   ```bash
   if [ ! -z "$VIM_FILE" ]; then
     vim "$VIM_FILE"
   fi

   if [ ! -z "$CUSTOM_ENV" ]; then
     echo "Running in $CUSTOM_ENV environment"
   fi
   ```

#### Troubleshooting

If environment variables aren't being set:

1. Verify the variables are permitted in `/etc/ssh/sshd_config`
2. Check SSH server logs for any related errors
3. Ensure variable names and values meet the security requirements
4. Test with a simple variable first to isolate any issues

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

## Client-Side Module

WebSSH2 uses a companion module called `webssh2_client` which provides the browser-side terminal interface and WebSocket communication layer.

### About webssh2_client

- **Repository**: [https://github.com/billchurch/webssh2_client](https://github.com/billchurch/webssh2_client)
- **Purpose**: Provides the browser-based terminal emulator and WebSocket client
- **Integration**: Automatically included as a dependency in package.json
- **Version**: The compatible version is managed through the package.json dependency

### Features

The client module provides:

- Terminal emulation using xterm.js
- WebSocket communication with the WebSSH2 server
- User interface for SSH connections
- Terminal configuration and customization
- Session management
- File transfer capabilities

### Client-Server Communication

The server integrates with the client module by:

1. Serving the client's static files from `/client/public`
2. Injecting server configuration into the client via `window.webssh2Config`
3. Managing WebSocket connections for terminal I/O
4. Handling authentication and session management

### Customization

More to follow...

## Tips

- For security, use HTTPS when transmitting credentials via HTTP Basic Auth.
- Terminal settings for `/ssh/host/:host` can be customized after login via `Menu | Settings` and persist across sessions.
- You can enable debug from the console by passing the `DEBUG` environment variable to your start script: `DEBUG=webssh*,-webssh2:ssh2 npm run start`. The `webssh2:ssh2` namespace is very chatty and shows all of the SSH protocol information, the `-webssh2:ssh2` excludes that namespace from the line above, otherwise `DEBUG=webssh*` will capture all of the WebSSH2 specific bits. You may also debug Socket.IO and Express related events with `engine`, `socket` and `express` namespaces, or go for broke and debug everything with `DEBUG=*`.
- For development information see [DEVELOPMENT.md](./DOCS/DEVELOPMENT.md).

For more detailed information on configuration and usage, please refer to the full documentation or open an issue on GitHub.

## Support

If you like what I do, and want to support me you can [buy me a coffee](https://www.buymeacoffee.com/billchurch)!

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/billchurch)
