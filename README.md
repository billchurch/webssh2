# WebSSH2 - Web SSH Client

![GitHub package.json version](https://img.shields.io/github/package-json/v/billchurch/webssh2)
 ![Docker Pulls](https://img.shields.io/docker/pulls/billchurch/webssh2)
 [![Contributors Guide](https://img.shields.io/badge/Contributors-Guide-blue?logo=github)](./DOCS/development/CONTRIBUTING.md)

![Orthrus Mascot](DOCS/images/orthrus2.png)

WebSSH2 is an HTML5 web-based terminal emulator and SSH client. It uses SSH2 as a client on a host to proxy a Websocket / Socket.io connection to an SSH2 server.

![WebSSH2 Screenshot](DOCS/images/Screenshot_sm.png)

## Quick Start

### Requirements

- Node.js 22 LTS (Jod) or later

### Installation

```bash
# Clone repository
git clone https://github.com/billchurch/webssh2.git
cd webssh2

# Install dependencies
npm install --production

# Start server
npm start
```

Access WebSSH2 at: `http://localhost:2222/ssh`

### Official Containers

- Preferred registry: `ghcr.io/billchurch/webssh2`
- Docker Hub mirror: `docker.io/billchurch/webssh2`
- Architectures: `linux/amd64`, `linux/arm64`

Pull the latest build from GitHub Container Registry:

```bash
docker pull ghcr.io/billchurch/webssh2:latest
```

Run the container exposing the default port:

```bash
docker run --rm -p 2222:2222 ghcr.io/billchurch/webssh2:latest
```

To pin to a specific release (example: `webssh2-server-v2.3.2`):

```bash
docker run --rm -p 2222:2222 \
  ghcr.io/billchurch/webssh2:2.3.2
```

The same tags are available on Docker Hub if you prefer the legacy namespace:

```bash
docker run --rm -p 2222:2222 docker.io/billchurch/webssh2:2.3.2
```

## Configuration

WebSSH2 prefers environment variables for configuration (following 12-factor app principles):

```bash
# Basic configuration
export WEBSSH2_LISTEN_PORT=2222
export WEBSSH2_SSH_HOST=ssh.example.com
export WEBSSH2_HEADER_TEXT="My WebSSH2"
# Allow only password and keyboard-interactive authentication methods (default allows all)
export WEBSSH2_AUTH_ALLOWED=password,keyboard-interactive

npm start
```

For detailed configuration options, see [Configuration Documentation](./DOCS/configuration/).

## Common Examples

### Connect to a specific host using HTTP Basic Auth

```bash
http://localhost:2222/ssh/host/192.168.1.100
```

### Custom port and terminal using interactive modal auth

```bash
http://localhost:2222/ssh?port=2244&sshterm=xterm-256color
```

### Docker with environment variables

```bash
docker run --rm -it \
  -p 2222:2222 \
  -e WEBSSH2_SSH_HOST=ssh.example.com \
  -e WEBSSH2_SSH_ALGORITHMS_PRESET=modern \
  -e WEBSSH2_AUTH_ALLOWED=password,publickey \
  ghcr.io/billchurch/webssh2:latest
```

Need the Docker Hub mirror instead? Use `docker.io/billchurch/webssh2:latest`.

## Documentation

### Getting Started

- [**Quick Start Guide**](./DOCS/getting-started/QUICK-START.md) - Get up and running in 5 minutes
- [Installation Guide](./DOCS/getting-started/INSTALLATION.md) - Detailed installation instructions
- [Docker Setup](./DOCS/getting-started/DOCKER.md) - Docker and Kubernetes deployment
- [Migration Guide](./DOCS/getting-started/MIGRATION.md) - Upgrading from older versions

### Configuration Documentation

- [Configuration Overview](./DOCS/configuration/OVERVIEW.md) - Configuration methods and priority
- [Environment Variables](./DOCS/configuration/ENVIRONMENT-VARIABLES.md) - Complete environment variable reference
- [URL Parameters](./DOCS/configuration/URL-PARAMETERS.md) - Query string parameters

### Feature Documentation

- [Authentication Methods](./DOCS/features/AUTHENTICATION.md) - Password, key-based, and SSO
- [Private Key Authentication](./DOCS/features/PRIVATE-KEYS.md) - SSH key setup and usage
- [Exec Channel](./DOCS/features/EXEC-CHANNEL.md) - Non-interactive command execution
- [Environment Forwarding](./DOCS/features/ENVIRONMENT-FORWARDING.md) - Pass environment variables
- [Host Key Verification](#host-key-verification) - MITM protection and key management

### Development

- [Contributing Guide](./DOCS/development/CONTRIBUTING.md) - How to contribute
- [Development Setup](./DOCS/development/SETUP.md) - Setting up development environment
- [API Documentation](./DOCS/api/) - WebSocket and REST APIs

### Release Artifacts

- [Build & Packaging Guide](./DOCS/BUILD.md) - Reproducible release flow and manifest format
- [Container Integration](./DOCS/CONTAINER.md) - Using the packaged bundle in images and CI

### Reference

- [Troubleshooting](./DOCS/reference/TROUBLESHOOTING.md) - Common issues and solutions
- [Breaking Changes](./DOCS/reference/BREAKING-CHANGES.md) - Version migration notes

## Features

- 🌐 **Web-based SSH** - No client software required
- 🔐 **Multiple Auth Methods** - Password, private key, keyboard-interactive
- 📱 **Responsive Design** - Works on desktop and mobile
- 🎨 **Customizable** - Themes, fonts, and terminal settings
- 🔌 **WebSocket** - Real-time bidirectional communication
- 🐳 **Docker Ready** - Official Docker images available
- 🔧 **Exec Channel** - Run commands without opening a shell
- 🌍 **Environment Variables** - Pass custom environment to SSH sessions
- 🛡️ **Subnet Restrictions** - IPv4/IPv6 CIDR subnet validation for access control
- 📁 **SFTP Support** - File transfer capabilities (v2.6.0+)

## Host Key Verification

Host key verification protects SSH connections against man-in-the-middle (MITM) attacks by validating the public key presented by the remote SSH server. When enabled, WebSSH2 compares the server's host key against a known-good key before allowing the connection to proceed. This is the same trust-on-first-use (TOFU) model used by OpenSSH.

The feature is **disabled by default** and must be explicitly enabled in configuration.

### Configuration

Add the `hostKeyVerification` block under `ssh` in `config.json`:

```json
{
  "ssh": {
    "hostKeyVerification": {
      "enabled": true,
      "mode": "hybrid",
      "unknownKeyAction": "prompt",
      "serverStore": {
        "enabled": true,
        "dbPath": "/data/hostkeys.db"
      },
      "clientStore": {
        "enabled": true
      }
    }
  }
}
```

### Modes of Operation

The `mode` setting is a shorthand that controls which key stores are active. Explicit `serverStore.enabled` and `clientStore.enabled` flags override the mode defaults when set.

| Mode | Server Store | Client Store | Description |
|------|:---:|:---:|---|
| `server` | on | off | Keys are verified exclusively against the server-side SQLite database. The client is never prompted. Best for locked-down environments where an administrator pre-seeds all host keys. |
| `client` | off | on | The server delegates verification to the browser client. The client stores accepted keys locally (e.g. in IndexedDB). Useful when no server-side database is available. |
| `hybrid` | on | on | The server store is checked first. If the key is unknown there, the client is asked. Provides server-enforced trust with client-side fallback for new hosts. **(default)** |

### Unknown Key Actions

When a host key is not found in any enabled store, the `unknownKeyAction` setting determines what happens:

| Action | Behavior |
|--------|----------|
| `prompt` | Emit a `hostkey:verify` event to the client and wait for the user to accept or reject the key. Connection is blocked until the user responds or the 30-second timeout expires. **(default)** |
| `alert` | Emit a `hostkey:alert` event to the client as a notification, but allow the connection to proceed. The key is not stored; the alert will appear again on the next connection. |
| `reject` | Emit a `hostkey:rejected` event and refuse the connection immediately. Only pre-seeded keys in the server store will be accepted. |

### Environment Variables

All host key settings can be configured via environment variables. Environment variables override `config.json` values.

| Variable | Config Path | Type | Default | Description |
|----------|-------------|------|---------|-------------|
| `WEBSSH2_SSH_HOSTKEY_ENABLED` | `ssh.hostKeyVerification.enabled` | boolean | `false` | Enable or disable host key verification |
| `WEBSSH2_SSH_HOSTKEY_MODE` | `ssh.hostKeyVerification.mode` | string | `hybrid` | Verification mode: `server`, `client`, or `hybrid` |
| `WEBSSH2_SSH_HOSTKEY_UNKNOWN_ACTION` | `ssh.hostKeyVerification.unknownKeyAction` | string | `prompt` | Action for unknown keys: `prompt`, `alert`, or `reject` |
| `WEBSSH2_SSH_HOSTKEY_DB_PATH` | `ssh.hostKeyVerification.serverStore.dbPath` | string | `/data/hostkeys.db` | Path to the SQLite host key database |
| `WEBSSH2_SSH_HOSTKEY_SERVER_ENABLED` | `ssh.hostKeyVerification.serverStore.enabled` | boolean | `true` | Enable the server-side SQLite store |
| `WEBSSH2_SSH_HOSTKEY_CLIENT_ENABLED` | `ssh.hostKeyVerification.clientStore.enabled` | boolean | `true` | Enable the client-side (browser) store |

### SQLite Server Store Setup

The server store uses a SQLite database that is opened in **read-only** mode at runtime. You must create and populate the database ahead of time using the seeding script (see below).

**Creating the database:**

```bash
# Probe a host to create and populate the database
npm run hostkeys -- --host ssh.example.com
```

The script automatically creates the database file (and parent directories) at the configured `dbPath` if it does not exist.

**Docker volume mounting:**

When running in Docker, mount a volume to the directory containing your database so it persists across container restarts. The mount path must match the `dbPath` value in your configuration:

```bash
docker run --rm -p 2222:2222 \
  -v /path/to/local/hostkeys:/data \
  -e WEBSSH2_SSH_HOSTKEY_ENABLED=true \
  -e WEBSSH2_SSH_HOSTKEY_DB_PATH=/data/hostkeys.db \
  ghcr.io/billchurch/webssh2:latest
```

### Seeding Script Usage

The `npm run hostkeys` command manages the SQLite host key database. It probes remote hosts via SSH to capture their public keys and stores them for later verification.

```bash
npm run hostkeys -- --help
```

**Probe a single host** (default port 22):

```bash
npm run hostkeys -- --host ssh.example.com
```

**Probe a host on a non-standard port:**

```bash
npm run hostkeys -- --host ssh.example.com --port 2222
```

**Bulk import from a hosts file** (one `host[:port]` per line, `#` comments allowed):

```bash
npm run hostkeys -- --hosts servers.txt
```

**Import from an OpenSSH `known_hosts` file:**

```bash
npm run hostkeys -- --known-hosts ~/.ssh/known_hosts
```

**List all stored keys:**

```bash
npm run hostkeys -- --list
```

**Remove all keys for a host:port pair:**

```bash
npm run hostkeys -- --remove ssh.example.com:22
```

**Use a custom database path:**

```bash
npm run hostkeys -- --list --db /custom/path/hostkeys.db
```

If `--db` is not specified, the script reads `dbPath` from `config.json`, falling back to `/data/hostkeys.db`.

### Socket Protocol Reference

The following Socket.IO events are used for host key verification. This reference is intended for CLI clients and third-party implementors integrating with the WebSSH2 WebSocket protocol.

**Server to Client:**

| Event | Payload | Description |
|-------|---------|-------------|
| `hostkey:verify` | `{ host, port, algorithm, fingerprint, key }` | Server is requesting the client to verify an unknown host key. The client must respond with `hostkey:verify-response`. `key` is the base64-encoded public key; `fingerprint` is the `SHA256:...` hash. |
| `hostkey:verified` | `{ host, port, algorithm, fingerprint, source }` | The host key was successfully verified. `source` is `"server"` or `"client"` indicating which store matched. Informational only; no response required. |
| `hostkey:mismatch` | `{ host, port, algorithm, presentedFingerprint, storedFingerprint, source }` | The presented key does not match the stored key. The connection is refused. `source` indicates which store detected the mismatch. |
| `hostkey:alert` | `{ host, port, algorithm, fingerprint }` | An unknown key was encountered and `unknownKeyAction` is set to `alert`. The connection proceeds. Informational only. |
| `hostkey:rejected` | `{ host, port, algorithm, fingerprint }` | An unknown key was encountered and `unknownKeyAction` is set to `reject`. The connection is refused. |

**Client to Server:**

| Event | Payload | Description |
|-------|---------|-------------|
| `hostkey:verify-response` | `{ action }` | Client response to a `hostkey:verify` prompt. `action` must be `"accept"`, `"reject"`, or `"trusted"` (key was already known to the client). If no response is received within 30 seconds, the connection is refused. |

### Troubleshooting

**Feature appears to have no effect:**
Host key verification is disabled by default (`enabled: false`). Set `WEBSSH2_SSH_HOSTKEY_ENABLED=true` or `"enabled": true` in `config.json` to activate it.

**Database not found at runtime:**
The server store opens the database in read-only mode. If the file at `dbPath` does not exist, all lookups return `"unknown"` and the store operates in degraded mode. Run `npm run hostkeys` to create and seed the database before starting the server.

**Host key mismatch:**
A `hostkey:mismatch` event means the SSH server is presenting a different key than what is stored in the database. This can happen after a legitimate server reinstall or key rotation. To resolve:

1. Verify the new key is legitimate (contact the server administrator).
2. Remove the old key: `npm run hostkeys -- --remove host:port`
3. Re-probe the host: `npm run hostkeys -- --host <hostname> --port <port>`

If you receive frequent mismatches for hosts you did not change, investigate for potential MITM attacks.

**Client verification times out:**
When using `prompt` mode, the client has 30 seconds to respond to a `hostkey:verify` event. If the client does not respond in time, the connection is refused. Ensure the client application handles the `hostkey:verify` Socket.IO event.

## Release Workflow Overview

- **Development**: Run `npm install` (or `npm ci`) and continue using scripts such as `npm run dev` and `npm run build`. The TypeScript sources remain the source of truth.
- **Release pipeline**: Use `npm ci --omit=dev`, `npm run build`, then `node dist/scripts/create-release-artifact.js` to produce `webssh2-<version>.tar.gz`, `manifest.json`, and a `.sha256` checksum. GNU tar is required to guarantee deterministic archives.
- **Packaged consumers (containers, downstream services)**: Download and verify the tarball, extract it, run `npm ci --omit=dev` from the extracted root (alongside `package.json`), and start with `NODE_ENV=production npm start`. The `prestart` script detects the precompiled bundle and skips rebuilding.

## Support

If you like what I do and want to support me, you can [buy me a coffee](https://www.buymeacoffee.com/billchurch)!

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/billchurch)

## License

[MIT License](LICENSE)
