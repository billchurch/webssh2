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

### 2a. Security Headers (New Default)
- The server now applies a secure set of HTTP response headers by default via `app/security-headers.js`.
- A Content Security Policy (CSP) is included and tuned for xterm.js and terminal styling. It purposely allows `'unsafe-inline'` for scripts/styles required by the client-side terminal rendering.
- These headers are applied before session middleware in `app/middleware.js`.

Notes:
- There is no config.json or environment toggle for CSP or headers at this time. To customize, adjust `app/security-headers.js` (or add a route-specific CSP using `createCSPMiddleware`).
- HSTS (`Strict-Transport-Security`) is set only when the request is HTTPS (`req.secure`).

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
    },
    "envAllowlist": ["ONLY_THIS", "AND_THAT"]
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

## Security Headers & CSP (Reference)

The default CSP and headers are defined in `app/security-headers.ts`. Header names and common defaults are centralized in `app/constants.ts` (`HEADERS`, `DEFAULTS`).

- `Content-Security-Policy`: restricts sources; allows WebSocket (`ws:`/`wss:`) connections and inline script/style needed by the terminal.
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`
- `X-XSS-Protection`: `1; mode=block`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: disables geolocation, microphone, camera
- `Strict-Transport-Security`: 1 year (HTTPS requests only); max-age is `DEFAULTS.HSTS_MAX_AGE_SECONDS`.

To customize globally, edit `CSP_CONFIG` or `SECURITY_HEADERS` in `app/security-headers.ts`. For per-route CSP, use `createCSPMiddleware(customCSP)` in your route setup.

### Centralized Constants

Common defaults live in `app/constants.ts`:
- `DEFAULTS`: server defaults (e.g., `SSH_READY_TIMEOUT_MS`, `IO_PING_INTERVAL_MS`, `SESSION_COOKIE_NAME`, `HSTS_MAX_AGE_SECONDS`).
- `ENV_LIMITS`: caps for environment variables forwarded to SSH.
- `HEADERS`: canonical HTTP header names used by the server.
### Credential Replay Line Ending

You can choose whether credential replay sends a carriage return (CR) or carriage return + line feed (CRLF).

- `options.replayCRLF` (boolean, default `false`): When `true`, the server will send CRLF when replaying credentials (useful for some sudo/tty configurations). When `false` (default), it sends CR only.

This option can also be controlled via the environment variable `WEBSSH2_OPTIONS_REPLAY_CRLF`.

### SSH Environment Variable Allowlist

Control which environment variable names are forwarded to the SSH session. If unset or empty, WebSSH2 applies format/value filtering but does not restrict by name beyond that.

- `ssh.envAllowlist` (array of strings): Only names in this list are forwarded, e.g. `['VIM_FILE','CUSTOM_ENV']`.
- Env var: `WEBSSH2_SSH_ENV_ALLOWLIST` can be provided as comma-separated or JSON array.

Notes:
- Keys must still match `^[A-Z][A-Z0-9_]*$` and values must not contain `; & | \` $` characters.
- A safety cap limits forwarding to the first 50 pairs.
