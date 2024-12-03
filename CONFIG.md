# Breaking Changes in Configuration Format

This document outlines the breaking changes and updates to the configuration format between versions. These changes require manual updates to your existing `config.json` files.

## Major Structure Changes

### Removed Sections
The following sections have been completely removed:
- `socketio` - Socket.IO configuration is now handled internally
- `terminal` - Terminal configuration moved to client-side
- `serverlog` - Logging configuration simplified
- `algorithms` - Moved under the `ssh` section
- `accesslog` - Removed
- `verify` - Removed
- `safeShutdownDuration` - Removed

### Renamed and Restructured Sections

#### HTTP Configuration
- Old: `socketio.origins`
- New: `http.origins`
```diff
- "socketio": {
-   "serveClient": false,
-   "path": "/ssh/socket.io",
-   "origins": ["localhost:2222"]
- }
+ "http": {
+   "origins": ["*.*"]
+ }
```

#### SSH Algorithms
- Old: Root-level `algorithms` object
- New: Moved to `ssh.algorithms`
```diff
- "algorithms": {
+ "ssh": {
+   "algorithms": {
      "kex": [...],
      "cipher": [...],
      "hmac": [...],
      "compress": [...]
+     "serverHostKey": [...]
    }
+ }
```

#### Session Configuration
```diff
  "session": {
-   "name": "WebSSH2",
+   "name": "webssh2",
    "secret": "secret"
  }
```

### New Options

#### SSH Configuration
Added under the `ssh` section:
```json
{
  "ssh": {
    "alwaysSendKeyboardInteractivePrompts": false,
    "disableInteractiveAuth": false
  }
}
```

#### Feature Options
Renamed and expanded options:
```diff
  "options": {
    "challengeButton": true,
-   "allowreauth": false
+   "autoLog": false,
+   "allowReauth": true,
+   "allowReconnect": true,
+   "allowReplay": true
  }
```

## Detailed Changes

### 1. Authentication Options
- Added support for SSH private key authentication via `user.privateKey` and passphrase encrypted private keys via `user.passphrase`
- Removed `user.overridebasic` option
- Added keyboard-interactive authentication controls

### 2. Server Settings
- Default port changed from 2224 to 2222
- Socket.IO path is now fixed at "/ssh/socket.io"
- Added server host key algorithm configurations

### 3. Terminal Configuration
All terminal-specific configurations have been removed from server config:
```diff
- "terminal": {
-   "cursorBlink": true,
-   "scrollback": 10000,
-   "tabStopWidth": 8,
-   "bellStyle": "sound",
-   "fontSize": 14
- }
```
These settings are now managed client-side.

## Migration Guide

1. Create a new `config.json` file based on the new format
2. Move your existing settings to their new locations
3. Remove any deprecated options
4. Add new required options
5. Test your configuration before deploying to production

## Default Configuration Example

```json
{
  "listen": {
    "ip": "0.0.0.0",
    "port": 2222
  },
  "http": {
    "origins": ["*.*"]
  },
  "user": {
    "name": null,
    "password": null,
    "privateKey": null,
    "passphrase": null
  },
  "ssh": {
    "host": null,
    "port": 22,
    "term": "xterm-color",
    "readyTimeout": 20000,
    "keepaliveInterval": 120000,
    "keepaliveCountMax": 10,
    "algorithms": {
      "cipher": [
        "aes128-ctr",
        "aes192-ctr",
        "aes256-ctr",
        "aes128-gcm",
        "aes128-gcm@openssh.com",
        "aes256-gcm",
        "aes256-gcm@openssh.com",
        "aes256-cbc"
      ],
      "compress": [
        "none",
        "zlib@openssh.com",
        "zlib"
      ],
      "hmac": [
        "hmac-sha2-256",
        "hmac-sha2-512",
        "hmac-sha1"
      ],
      "kex": [
        "ecdh-sha2-nistp256",
        "ecdh-sha2-nistp384",
        "ecdh-sha2-nistp521",
        "diffie-hellman-group-exchange-sha256",
        "diffie-hellman-group14-sha1"
      ],
      "serverHostKey": [
        "ecdsa-sha2-nistp256",
        "ecdsa-sha2-nistp384",
        "ecdsa-sha2-nistp521",
        "ssh-rsa"
      ]
    }
  },
  "options": {
    "challengeButton": true,
    "autoLog": false,
    "allowReauth": true,
    "allowReconnect": true,
    "allowReplay": true
  }
}
```