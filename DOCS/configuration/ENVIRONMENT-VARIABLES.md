# WebSSH2 Environment Variables

WebSSH2 supports comprehensive configuration through environment variables, following the [12-Factor App](https://12factor.net/config) methodology. This makes it ideal for Docker containers, Kubernetes deployments, and cloud-native applications.

## Configuration Priority

Configuration is loaded with the following priority (highest to lowest):

1. **Environment Variables** (highest priority)
2. `config.json` file
3. Built-in defaults (lowest priority)

## Environment Variable Format

All WebSSH2 environment variables use the `WEBSSH2_` prefix with underscore-delimited paths:

```bash
WEBSSH2_<SECTION>_<SETTING>=value
```

### Examples

```bash
WEBSSH2_LISTEN_PORT=3000
WEBSSH2_SSH_HOST=example.com
WEBSSH2_HEADER_TEXT="Production Environment"
```

## Complete Environment Variable Reference

### Server Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_LISTEN_IP` | string | `0.0.0.0` | IP address to bind the server to |
| `WEBSSH2_LISTEN_PORT` | number | `2222` | Port number for the web server |
| `PORT` | number | `2222` | Legacy port variable (use WEBSSH2_LISTEN_PORT) |

### HTTP Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_HTTP_ORIGINS` | array | `["*:*"]` | CORS allowed origins (comma-separated or JSON) |

#### Array Format Examples

```bash
# Comma-separated format
WEBSSH2_HTTP_ORIGINS="localhost:3000,*.example.com,api.test.com"

# JSON array format
WEBSSH2_HTTP_ORIGINS='["localhost:3000","*.example.com","api.test.com"]'
```

### Security Headers & CSP

The server applies security headers and a Content Security Policy (CSP) by default.

- Configuration: Defined in code at `app/security-headers.js` and applied by `app/middleware.js`.
- Environment variables: There are currently no `WEBSSH2_` environment variables to toggle or customize CSP/headers.
- Customization options:
  - Edit `CSP_CONFIG` and `SECURITY_HEADERS` in `app/security-headers.js` for global changes.
  - Use `createCSPMiddleware(customCSP)` for route-specific CSP overrides.
  - HSTS (`Strict-Transport-Security`) is only added on HTTPS requests.

### User Defaults

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_USER_NAME` | string | `null` | Default username for SSH connections |
| `WEBSSH2_USER_PASSWORD` | string | `null` | Default password for SSH connections |
| `WEBSSH2_USER_PRIVATE_KEY` | string | `null` | Default private key (base64 encoded or file path) |
| `WEBSSH2_USER_PASSPHRASE` | string | `null` | Passphrase for encrypted private keys |

### SSH Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_SSH_HOST` | string | `null` | Default SSH host to connect to |
| `WEBSSH2_SSH_PORT` | number | `22` | Default SSH port |
| `WEBSSH2_SSH_LOCAL_ADDRESS` | string | `null` | Local address for SSH connections |
| `WEBSSH2_SSH_LOCAL_PORT` | number | `null` | Local port for SSH connections |
| `WEBSSH2_SSH_TERM` | string | `xterm-color` | Terminal type |
| `WEBSSH2_SSH_READY_TIMEOUT` | number | `20000` | Connection ready timeout (ms) |
| `WEBSSH2_SSH_KEEPALIVE_INTERVAL` | number | `120000` | Keep-alive interval (ms) |
| `WEBSSH2_SSH_KEEPALIVE_COUNT_MAX` | number | `10` | Maximum keep-alive count |
| `WEBSSH2_SSH_ALLOWED_SUBNETS` | array | `[]` | Allowed subnets - IPv4/IPv6 CIDR notation (comma-separated) |
| `WEBSSH2_SSH_ALWAYS_SEND_KEYBOARD_INTERACTIVE` | boolean | `false` | Always send keyboard-interactive prompts to client |
| `WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH` | boolean | `false` | Disable interactive authentication |
| `WEBSSH2_SSH_ENV_ALLOWLIST` | array | `[]` | Only these environment variable names are forwarded to SSH (comma-separated or JSON). Caps: max 50 pairs; key length ≤ 32; value length ≤ 512. |
| `WEBSSH2_AUTH_ALLOWED` | array | `password,keyboard-interactive,publickey` | Ordered allow list of SSH auth methods. Unknown tokens are ignored. If the list resolves to empty, startup fails. |
| `WEBSSH2_SSH_MAX_EXEC_OUTPUT_BYTES` | number | `10485760` (10MB) | Maximum bytes buffered for exec command output before truncation |
| `WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC` | number | `0` (unlimited) | Rate limit for shell output streams (bytes/second). `0` disables rate limiting |
| `WEBSSH2_SSH_SOCKET_HIGH_WATER_MARK` | number | `16384` (16KB) | Socket.IO buffer threshold for stream backpressure control |

### Host Key Verification

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_SSH_HOSTKEY_ENABLED` | boolean | `false` | Enable or disable SSH host key verification |
| `WEBSSH2_SSH_HOSTKEY_MODE` | string | `hybrid` | Verification mode: `server`, `client`, or `hybrid` |
| `WEBSSH2_SSH_HOSTKEY_UNKNOWN_ACTION` | string | `prompt` | Action for unknown keys: `prompt`, `alert`, or `reject` |
| `WEBSSH2_SSH_HOSTKEY_DB_PATH` | string | `/data/hostkeys.db` | Path to the SQLite host key database (opened read-only by the app) |
| `WEBSSH2_SSH_HOSTKEY_SERVER_ENABLED` | boolean | *(from mode)* | Override: enable/disable server-side SQLite store |
| `WEBSSH2_SSH_HOSTKEY_CLIENT_ENABLED` | boolean | *(from mode)* | Override: enable/disable client-side browser store |

#### Host Key Verification Examples

**Enable hybrid mode (server-first, client fallback):**

```bash
WEBSSH2_SSH_HOSTKEY_ENABLED=true
WEBSSH2_SSH_HOSTKEY_MODE=hybrid
```

**Server-only with strict rejection of unknown keys:**

```bash
WEBSSH2_SSH_HOSTKEY_ENABLED=true
WEBSSH2_SSH_HOSTKEY_MODE=server
WEBSSH2_SSH_HOSTKEY_UNKNOWN_ACTION=reject
WEBSSH2_SSH_HOSTKEY_DB_PATH=/data/hostkeys.db
```

**Client-only (no server database needed):**

```bash
WEBSSH2_SSH_HOSTKEY_ENABLED=true
WEBSSH2_SSH_HOSTKEY_MODE=client
```

**Docker with host key database volume:**

```bash
docker run -d \
  -p 2222:2222 \
  -v /path/to/hostkeys.db:/data/hostkeys.db:ro \
  -e WEBSSH2_SSH_HOSTKEY_ENABLED=true \
  -e WEBSSH2_SSH_HOSTKEY_MODE=server \
  webssh2:latest
```

#### Mode Behavior

The `mode` sets sensible defaults for which stores are enabled:

| Mode | Server Store | Client Store |
|------|-------------|-------------|
| `server` | enabled | disabled |
| `client` | disabled | enabled |
| `hybrid` | enabled | enabled |

Explicit `WEBSSH2_SSH_HOSTKEY_SERVER_ENABLED` and `WEBSSH2_SSH_HOSTKEY_CLIENT_ENABLED` override mode defaults.

See [CONFIG-JSON.md](./CONFIG-JSON.md) for `config.json` examples and the seeding script usage.

### SFTP Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_SSH_SFTP_ENABLED` | boolean | `false` | Enable or disable SFTP file browser functionality |
| `WEBSSH2_SSH_SFTP_MAX_FILE_SIZE` | number | `104857600` (100MB) | Maximum file size for uploads/downloads in bytes |
| `WEBSSH2_SSH_SFTP_TRANSFER_RATE_LIMIT_BYTES_PER_SEC` | number | `0` (unlimited) | Transfer rate limit in bytes/second. `0` disables rate limiting |
| `WEBSSH2_SSH_SFTP_CHUNK_SIZE` | number | `32768` (32KB) | Chunk size for file transfers in bytes |
| `WEBSSH2_SSH_SFTP_MAX_CONCURRENT_TRANSFERS` | number | `2` | Maximum concurrent file transfers per session |
| `WEBSSH2_SSH_SFTP_ALLOWED_PATHS` | array | `null` (all paths) | Restrict SFTP access to specific directories (comma-separated or JSON) |
| `WEBSSH2_SSH_SFTP_BLOCKED_EXTENSIONS` | array | `[]` | File extensions to block from uploads/downloads (comma-separated or JSON) |
| `WEBSSH2_SSH_SFTP_TIMEOUT` | number | `30000` (30s) | Operation timeout in milliseconds |

#### SFTP Configuration Examples

**Enable SFTP with size limit:**

```bash
# Enable SFTP with 50MB file size limit (SFTP is disabled by default)
WEBSSH2_SSH_SFTP_ENABLED=true
WEBSSH2_SSH_SFTP_MAX_FILE_SIZE=52428800
```

**Restricted SFTP for shared hosting:**

```bash
# Enable SFTP (disabled by default)
WEBSSH2_SSH_SFTP_ENABLED=true

# Restrict to home directory only
WEBSSH2_SSH_SFTP_ALLOWED_PATHS="~,/home"

# Block dangerous file extensions
WEBSSH2_SSH_SFTP_BLOCKED_EXTENSIONS=".exe,.sh,.bash,.py,.php,.pl"

# Rate limit transfers to 1MB/s
WEBSSH2_SSH_SFTP_TRANSFER_RATE_LIMIT_BYTES_PER_SEC=1048576
```

**High-performance SFTP for trusted environments:**

```bash
# Enable SFTP (disabled by default)
WEBSSH2_SSH_SFTP_ENABLED=true

# Larger file size limit (500MB)
WEBSSH2_SSH_SFTP_MAX_FILE_SIZE=524288000

# Larger chunks for faster transfers
WEBSSH2_SSH_SFTP_CHUNK_SIZE=65536

# Allow more concurrent transfers
WEBSSH2_SSH_SFTP_MAX_CONCURRENT_TRANSFERS=5

# No rate limiting
WEBSSH2_SSH_SFTP_TRANSFER_RATE_LIMIT_BYTES_PER_SEC=0
```

**Disable SFTP entirely (default):**

```bash
# SFTP is disabled by default, but you can explicitly disable it
WEBSSH2_SSH_SFTP_ENABLED=false
```

### Telnet Configuration

> **Security Warning:** Telnet transmits all data, including credentials, in **plain text**. Only use telnet on trusted networks or for legacy devices that do not support SSH.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_TELNET_ENABLED` | boolean | `false` | Enable or disable telnet support. When disabled, `/telnet` routes return 404 |
| `WEBSSH2_TELNET_DEFAULT_PORT` | number | `23` | Default telnet port |
| `WEBSSH2_TELNET_TIMEOUT` | number | `30000` | Connection timeout in milliseconds |
| `WEBSSH2_TELNET_TERM` | string | `vt100` | Terminal type for TERMINAL-TYPE negotiation |
| `WEBSSH2_TELNET_AUTH_LOGIN_PROMPT` | string | `login:\s*$` | Regex pattern to detect login prompt |
| `WEBSSH2_TELNET_AUTH_PASSWORD_PROMPT` | string | `[Pp]assword:\s*$` | Regex pattern to detect password prompt |
| `WEBSSH2_TELNET_AUTH_FAILURE_PATTERN` | string | `Login incorrect\|Access denied\|Login failed` | Regex pattern to detect authentication failure |
| `WEBSSH2_TELNET_AUTH_EXPECT_TIMEOUT` | number | `10000` | Max time (ms) to wait for prompt matches before falling back to pass-through mode |
| `WEBSSH2_TELNET_ALLOWED_SUBNETS` | array | `[]` | Comma-separated CIDR ranges restricting which hosts can be connected to via telnet (e.g., `10.0.0.0/8,192.168.0.0/16`) |

#### Telnet Configuration Examples

**Enable telnet with defaults:**

```bash
# Enable telnet support (disabled by default)
WEBSSH2_TELNET_ENABLED=true
```

**Custom prompts for non-standard devices:**

```bash
# Enable telnet
WEBSSH2_TELNET_ENABLED=true

# Custom prompt patterns for network equipment
WEBSSH2_TELNET_AUTH_LOGIN_PROMPT="Username:\\s*$"
WEBSSH2_TELNET_AUTH_PASSWORD_PROMPT="Password:\\s*$"
WEBSSH2_TELNET_AUTH_FAILURE_PATTERN="Authentication failed|Bad password|Access denied"

# Longer timeout for slow devices
WEBSSH2_TELNET_AUTH_EXPECT_TIMEOUT=15000
```

**Docker with telnet enabled:**

```bash
docker run -d \
  -p 2222:2222 \
  -e WEBSSH2_TELNET_ENABLED=true \
  -e WEBSSH2_TELNET_DEFAULT_PORT=23 \
  -e WEBSSH2_TELNET_TERM=vt100 \
  webssh2:latest
```

**Disable telnet (default):**

```bash
# Telnet is disabled by default, but you can explicitly disable it
WEBSSH2_TELNET_ENABLED=false
```

See [CONFIG-JSON.md](./CONFIG-JSON.md) for `config.json` examples and additional details.

#### Authentication Allow List

`WEBSSH2_AUTH_ALLOWED` lets administrators enforce which SSH authentication methods can be used. Supported tokens are:

- `password`
- `keyboard-interactive`
- `publickey`

The list is evaluated in order and duplicates are removed automatically. Methods not included in the list are rejected before credentials are forwarded to the SSH server, and the UI exposes only the allowed choices. When the variable is unset, all three methods remain available (backward-compatible behaviour).

### SSH Subnet Restrictions

The `WEBSSH2_SSH_ALLOWED_SUBNETS` variable enables network access control by restricting SSH connections to specific IP subnets. When configured, only hosts within the specified subnets can be accessed.

#### Features

- **IPv4 Support**: Full CIDR notation (/0 to /32), exact IPs, and wildcards
- **IPv6 Support**: Full CIDR notation (/0 to /128) and exact IPs
- **Mixed Networks**: Configure both IPv4 and IPv6 subnets together
- **DNS Resolution**: Hostnames are resolved and validated against allowed subnets

#### Subnet Format Examples

```bash
# IPv4 CIDR notation
WEBSSH2_SSH_ALLOWED_SUBNETS="192.168.1.0/24,10.0.0.0/8"

# IPv6 CIDR notation
WEBSSH2_SSH_ALLOWED_SUBNETS="2001:db8::/32,fe80::/10"

# Mixed IPv4 and IPv6
WEBSSH2_SSH_ALLOWED_SUBNETS="127.0.0.0/8,::1/128"

# Exact IP addresses
WEBSSH2_SSH_ALLOWED_SUBNETS="192.168.1.100,2001:db8::1"

# IPv4 wildcards (IPv4 only)
WEBSSH2_SSH_ALLOWED_SUBNETS="192.168.*.*,10.0.1.*"

# Complex example with all formats
WEBSSH2_SSH_ALLOWED_SUBNETS="10.0.0.0/8,192.168.1.100,172.16.*.*,::1/128,2001:db8::/32"
```

#### Common Use Cases

```bash
# Allow only localhost connections (IPv4 and IPv6)
WEBSSH2_SSH_ALLOWED_SUBNETS="127.0.0.0/8,::1/128"

# Allow only private networks (RFC 1918 + RFC 4193)
WEBSSH2_SSH_ALLOWED_SUBNETS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7"

# Allow specific office network
WEBSSH2_SSH_ALLOWED_SUBNETS="203.0.113.0/24,2001:db8:1234::/48"
```

#### Important Notes

- When no subnets are specified, all connections are allowed (default behavior)
- Hostnames are resolved to IP addresses before validation
- If a hostname resolves to multiple IPs, connection is allowed if any IP matches
- Connection is blocked before SSH authentication if host is not in allowed subnets

### SSH Algorithms

You can configure SSH algorithms in two ways:

#### Option 1: Algorithm Preset (Recommended)

| Variable | Values | Description |
|----------|--------|-------------|
| `WEBSSH2_SSH_ALGORITHMS_PRESET` | `modern`, `legacy`, `strict` | Use predefined algorithm sets |

**Preset Details:**

- **`modern`**: Strong algorithms for contemporary systems
- **`legacy`**: Compatible with older SSH implementations  
- **`strict`**: Only the most secure algorithms

#### Option 2: Individual Algorithm Arrays

| Variable | Type | Description |
|----------|------|-------------|
| `WEBSSH2_SSH_ALGORITHMS_CIPHER` | array | Encryption algorithms |
| `WEBSSH2_SSH_ALGORITHMS_KEX` | array | Key exchange algorithms |
| `WEBSSH2_SSH_ALGORITHMS_HMAC` | array | MAC algorithms |
| `WEBSSH2_SSH_ALGORITHMS_COMPRESS` | array | Compression algorithms |
| `WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY` | array | Server host key algorithms |

#### Algorithm Precedence

**Individual algorithm settings override preset values.** When both a preset and individual algorithm variables are specified, the preset is applied first as a baseline, then individual settings override specific algorithm types.

This allows you to extend presets with additional algorithms for legacy compatibility:

```bash
# Use modern preset as baseline, but add hmac-sha1 for legacy server support
WEBSSH2_SSH_ALGORITHMS_PRESET=modern
WEBSSH2_SSH_ALGORITHMS_HMAC="hmac-sha1,hmac-sha2-256,hmac-sha2-512"

# Result: Modern preset algorithms are used, except HMAC which uses your custom list
```

#### Algorithm Examples

**Using preset (recommended):**

```bash
# Simple modern security profile
WEBSSH2_SSH_ALGORITHMS_PRESET=modern
```

**Using individual arrays only:**

```bash
# Full manual configuration (no preset)
WEBSSH2_SSH_ALGORITHMS_CIPHER="aes256-gcm@openssh.com,aes128-gcm@openssh.com"
WEBSSH2_SSH_ALGORITHMS_KEX="ecdh-sha2-nistp256,ecdh-sha2-nistp384"
WEBSSH2_SSH_ALGORITHMS_HMAC="hmac-sha2-256,hmac-sha2-512"
WEBSSH2_SSH_ALGORITHMS_COMPRESS="none,zlib@openssh.com"
WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY="ecdsa-sha2-nistp256,ssh-rsa"
```

**Extending preset with legacy compatibility:**

```bash
# Government/legacy server requiring hmac-sha1 alongside modern algorithms
WEBSSH2_SSH_ALGORITHMS_PRESET=modern
WEBSSH2_SSH_ALGORITHMS_HMAC="hmac-sha1,hmac-sha2-256,hmac-sha2-512"

# FIPS environment with custom host keys
WEBSSH2_SSH_ALGORITHMS_PRESET=strict
WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY="rsa-sha2-256,rsa-sha2-512"
```

### SSH Stream Backpressure and Output Limits

Prevent out-of-memory (OOM) crashes from high-volume SSH output.

WebSSH2 includes built-in protection against resource exhaustion when SSH commands or shell sessions generate large amounts of data. This prevents scenarios where commands like `cat /dev/urandom | base64` or processing very large files could crash the Node.js process.

#### Configuration Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_SSH_MAX_EXEC_OUTPUT_BYTES` | number | `10485760` (10MB) | Maximum output size for exec commands before truncation |
| `WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC` | number | `0` (unlimited) | Rate limit for shell output streams (bytes/second) |
| `WEBSSH2_SSH_SOCKET_HIGH_WATER_MARK` | number | `16384` (16KB) | Socket.IO buffer threshold for backpressure |

#### How It Works

**Exec Command Limits**: When using the Socket.IO `exec` event to run commands, output is buffered in memory. If output exceeds `maxExecOutputBytes`, it's truncated with a `[OUTPUT TRUNCATED: Exceeded maximum output size]` message.

**Shell Rate Limiting**: When `outputRateLimitBytesPerSec` is non-zero, the SSH stream is throttled to prevent overwhelming the WebSocket connection. The stream automatically pauses and resumes to maintain the configured rate.

**Backpressure Control**: When Socket.IO's send buffer exceeds `socketHighWaterMark`, the SSH stream pauses until the buffer drains, preventing unbounded memory growth.

#### Usage Examples

**Production environment with OOM protection:**

```bash
# Enable 1MB/s rate limiting to prevent crashes
WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC=1048576
WEBSSH2_SSH_MAX_EXEC_OUTPUT_BYTES=10485760
WEBSSH2_SSH_SOCKET_HIGH_WATER_MARK=16384
```

**High-throughput trusted environment:**

```bash
# Allow larger buffers and higher throughput
WEBSSH2_SSH_MAX_EXEC_OUTPUT_BYTES=52428800          # 50MB
WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC=5242880 # 5MB/s
WEBSSH2_SSH_SOCKET_HIGH_WATER_MARK=65536            # 64KB
```

**Restricted/untrusted environment:**

```bash
# Strict limits for resource-constrained or multi-tenant deployments
WEBSSH2_SSH_MAX_EXEC_OUTPUT_BYTES=1048576           # 1MB
WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC=262144  # 256KB/s
WEBSSH2_SSH_SOCKET_HIGH_WATER_MARK=8192             # 8KB
```

**Development (unlimited):**

```bash
# No rate limiting (default behavior)
WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC=0
```

#### Testing

Test the protection with high-volume commands:

```bash
# Small test (should work fine)
cat /dev/urandom | base64 | head -c 10M

# Large test (will be rate-limited if configured)
cat /dev/urandom | base64 | head -c 100M

# Infinite stream (will be throttled indefinitely)
cat /dev/urandom | base64
```

With rate limiting enabled, you'll see gradual output instead of rapid data flood, and the Node.js process will remain stable.

#### Performance Impact

- **Rate limiting disabled** (`0`): No performance impact, maximum throughput
- **Rate limiting enabled**: Slight CPU overhead for throttling logic, but prevents memory exhaustion
- **Recommended for production**: Enable rate limiting at 1-5 MB/s depending on use case

See [CONFIG-JSON.md](./CONFIG-JSON.md) for `config.json` examples and additional details.

### Web Interface

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_HEADER_TEXT` | string | `null` | Header text in web interface |
| `WEBSSH2_HEADER_BACKGROUND` | string | `green` | Header background color |

### Logging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_LOGGING_LEVEL` | string | `info` | Global minimum log level (`debug`, `info`, `warn`, `error`) |
| `WEBSSH2_LOGGING_STDOUT_ENABLED` | boolean | `true` | Enables stdout transport when `true` |
| `WEBSSH2_LOGGING_STDOUT_MIN_LEVEL` | string | `info` | Per-transport minimum level for stdout delivery |
| `WEBSSH2_LOGGING_SYSLOG_ENABLED` | boolean | `false` | Enables RFC 5424/TLS syslog forwarding |
| `WEBSSH2_LOGGING_SYSLOG_HOST` | string | `null` | Syslog collector hostname or IP |
| `WEBSSH2_LOGGING_SYSLOG_PORT` | number | `6514` | Syslog collector port (TLS default) |
| `WEBSSH2_LOGGING_SYSLOG_APP_NAME` | string | `webssh2` | Syslog `APP-NAME` field |
| `WEBSSH2_LOGGING_SYSLOG_ENTERPRISE_ID` | number | `32473` | Enterprise ID for structured data (`webssh2@<ID>`) |
| `WEBSSH2_LOGGING_SYSLOG_TLS_ENABLED` | boolean | `true` | Enables TLS transport as per RFC 5425 |
| `WEBSSH2_LOGGING_SYSLOG_TLS_CA_FILE` | string | `null` | Path to CA bundle when TLS is enabled |
| `WEBSSH2_LOGGING_SYSLOG_TLS_CERT_FILE` | string | `null` | Path to client certificate for mutual TLS |
| `WEBSSH2_LOGGING_SYSLOG_TLS_KEY_FILE` | string | `null` | Path to private key paired with client cert |
| `WEBSSH2_LOGGING_SYSLOG_TLS_REJECT_UNAUTHORIZED` | boolean | `true` | Reject syslog server certificates failing validation |
| `WEBSSH2_LOGGING_SYSLOG_BUFFER_SIZE` | number | `1000` | Maximum in-memory message backlog before drop |
| `WEBSSH2_LOGGING_SYSLOG_FLUSH_INTERVAL_MS` | number | `1000` | Flush cadence for buffered syslog messages |
| `WEBSSH2_LOGGING_SYSLOG_INCLUDE_JSON` | boolean | `false` | Attach JSON payload after syslog structured data |
| `WEBSSH2_LOGGING_SAMPLING_DEFAULT_RATE` | number | `1` | Default probability (0-1) for emitting sampled events |
| `WEBSSH2_LOGGING_SAMPLING_RULES` | string | `null` | JSON array of sampling overrides (`[{"target":"*","sampleRate":0.25}]`) |
| `WEBSSH2_LOGGING_RATE_LIMIT_RULES` | string | `null` | JSON describing token-bucket rules (`[{"target":"ssh_command","limit":5,"intervalMs":1000,"burst":5}]`) |

> **Note:** Wrap complex JSON values (such as `WEBSSH2_LOGGING_RATE_LIMIT_RULES` or `WEBSSH2_LOGGING_SAMPLING_RULES`) in single quotes to prevent shell interpolation. Sampling rules can be supplied via `config.json` for richer targeting (per-event overrides).

## Quick Start Examples

Set common settings using environment variables (preferred):

```bash
# Listen on port 2222 and allow all origins during development
WEBSSH2_LISTEN_PORT=2222 \
WEBSSH2_HTTP_ORIGINS="*:*" \

# Default SSH target
WEBSSH2_SSH_HOST=ssh.example.com \
WEBSSH2_SSH_PORT=22 \
WEBSSH2_SSH_TERM=xterm-256color \

# UI header
WEBSSH2_HEADER_TEXT="WebSSH2" \
WEBSSH2_HEADER_BACKGROUND=green \

# Behavior options
WEBSSH2_OPTIONS_ALLOW_RECONNECT=true \
WEBSSH2_OPTIONS_ALLOW_REAUTH=true \
WEBSSH2_OPTIONS_ALLOW_REPLAY=true \

# Security: algorithms preset
WEBSSH2_SSH_ALGORITHMS_PRESET=modern
```

Examples with Docker (inline `-e` flags):

```bash
docker run --name webssh2 --rm -it \
  -p 2222:2222 \
  -e WEBSSH2_LISTEN_PORT=2222 \
  -e WEBSSH2_HTTP_ORIGINS="*:*" \
  -e WEBSSH2_SSH_HOST=ssh.example.com \
  -e WEBSSH2_SSH_PORT=22 \
  -e WEBSSH2_HEADER_TEXT="WebSSH2" \
  -e WEBSSH2_SSH_ALGORITHMS_PRESET=modern \
  webssh2
```

### Application Options

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_OPTIONS_CHALLENGE_BUTTON` | boolean | `true` | Show challenge button |
| `WEBSSH2_OPTIONS_AUTO_LOG` | boolean | `false` | Enable automatic logging |
| `WEBSSH2_OPTIONS_ALLOW_REAUTH` | boolean | `true` | Allow reauthentication |
| `WEBSSH2_OPTIONS_ALLOW_RECONNECT` | boolean | `true` | Allow reconnection |
| `WEBSSH2_OPTIONS_ALLOW_REPLAY` | boolean | `true` | Allow session replay |
| `WEBSSH2_OPTIONS_REPLAY_CRLF` | boolean | `false` | Send CRLF for credential replay (default is CR) |

### Session Management

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_SESSION_SECRET` | string | auto-generated | Session encryption secret |
| `WEBSSH2_SESSION_NAME` | string | `webssh2.sid` | Session cookie name |

### SSO Configuration (Single Sign-On)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_SSO_ENABLED` | boolean | `false` | Enable SSO authentication via trusted headers |
| `WEBSSH2_SSO_CSRF_PROTECTION` | boolean | `true` | Enable CSRF protection for SSO endpoints |
| `WEBSSH2_SSO_TRUSTED_PROXIES` | array | `[]` | IP addresses/subnets of trusted reverse proxies (comma-separated or JSON) |
| `WEBSSH2_SSO_HEADER_USERNAME` | string | `null` | HTTP header containing the username |
| `WEBSSH2_SSO_HEADER_PASSWORD` | string | `null` | HTTP header containing the password |
| `WEBSSH2_SSO_HEADER_SESSION` | string | `null` | HTTP header containing the session identifier |

#### SSO Example

```bash
# Enable SSO with header-based authentication behind a reverse proxy
WEBSSH2_SSO_ENABLED=true
WEBSSH2_SSO_CSRF_PROTECTION=true
WEBSSH2_SSO_TRUSTED_PROXIES="10.0.0.0/8,172.16.0.0/12"
WEBSSH2_SSO_HEADER_USERNAME="X-Auth-Username"
WEBSSH2_SSO_HEADER_PASSWORD="X-Auth-Password"
```

#### SSO Security Notes

- **Trusted Proxies**: Only configure trusted proxy IPs/subnets. Requests from untrusted sources will have SSO headers ignored.
- **CSRF Protection**: Keep enabled unless your reverse proxy handles CSRF protection.
- **Header Security**: Ensure your reverse proxy strips incoming SSO headers from client requests to prevent header injection attacks.

## Data Type Formats

### Boolean Values

Use `true`/`false` or `1`/`0`:

```bash
WEBSSH2_OPTIONS_AUTO_LOG=true
WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH=false
```

### Array Values

Two formats supported:

**Comma-separated (simple values):**

```bash
WEBSSH2_HTTP_ORIGINS="localhost:3000,*.example.com"
```

**JSON array (complex values or special characters):**

```bash
WEBSSH2_SSH_ALGORITHMS_CIPHER='["aes256-gcm@openssh.com","aes128-ctr"]'
```

### Null Values

Use empty string or `null`:

```bash
WEBSSH2_SSH_HOST=
WEBSSH2_USER_NAME=null
```

## Docker Examples

### Basic Docker Run

```bash
docker run -d \
  -p 2222:2222 \
  -e WEBSSH2_SSH_HOST=ssh.example.com \
  -e WEBSSH2_HEADER_TEXT="Production SSH" \
  -e WEBSSH2_HEADER_BACKGROUND=red \
  -e WEBSSH2_SESSION_SECRET=your-secret-key \
  webssh2:latest
```

### Docker with Modern Security

```bash
docker run -d \
  -p 2222:2222 \
  -e WEBSSH2_SSH_ALGORITHMS_PRESET=modern \
  -e WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH=false \
  -e WEBSSH2_HEADER_TEXT="Secure SSH Gateway" \
  webssh2:latest
```

### Docker Compose

See `docker-compose.yml` for a complete example configuration.

## Kubernetes ConfigMap Example

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: webssh2-config
data:
  WEBSSH2_LISTEN_PORT: "2222"
  WEBSSH2_SSH_HOST: "ssh.example.com"
  WEBSSH2_SSH_ALGORITHMS_PRESET: "modern"
  WEBSSH2_HEADER_TEXT: "Kubernetes SSH Gateway"
  WEBSSH2_HEADER_BACKGROUND: "blue"
  WEBSSH2_HTTP_ORIGINS: "*.example.com,localhost:*"
```

## Environment-First vs Config File

### Advantages of Environment Variables

- **Security**: No secrets in config files
- **Flexibility**: Easy per-environment configuration
- **Cloud-native**: Works with Docker, Kubernetes, etc.
- **CI/CD friendly**: Easy automated deployment configuration

### When to Use Config Files

- **Development**: Easier to manage many settings locally
- **Complex configurations**: Multiple algorithm arrays
- **Documentation**: Comments and structure in JSON

### Hybrid Approach

You can use both - environment variables override config.json:

```bash
# config.json has base settings
# Environment variables override specific values
WEBSSH2_LISTEN_PORT=3000
WEBSSH2_SSH_HOST=prod.example.com
```

## Validation and Debugging

### Debug Configuration Loading

Enable debug output to see configuration loading:

```bash
DEBUG=webssh2:config,webssh2:envConfig npm start
```

### Validation Errors

If configuration validation fails, the server will:

1. Log validation errors
2. Continue with unvalidated config in development
3. Use default values for invalid settings

### Testing Configuration

Test your environment variable configuration:

```bash
node -e "
import { getConfig } from './app/config.js';
const config = await getConfig();
console.log(JSON.stringify(config, null, 2));
"
```

## Migration from Config File

### Step 1: Identify Current Settings

Review your current `config.json` and identify values to move to environment variables.

### Step 2: Set Environment Variables

Convert config paths to environment variable names:

- `listen.port` → `WEBSSH2_LISTEN_PORT`
- `ssh.algorithms.cipher` → `WEBSSH2_SSH_ALGORITHMS_CIPHER`

### Step 3: Test Configuration

Verify environment variables take precedence over config file settings.

### Step 4: Remove Config File (Optional)

Once satisfied with environment variable configuration, you can remove `config.json`.

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use secure secret management** for `WEBSSH2_SESSION_SECRET`
3. **Restrict algorithm presets** - use `strict` for high-security environments
4. **Validate origins** - don't use wildcard origins (`*:*`) in production
5. **Use HTTPS** in production environments
6. **Rotate session secrets** regularly

## Troubleshooting

### Environment Variables Not Taking Effect

1. Check variable names are correct (case-sensitive)
2. Ensure `WEBSSH2_` prefix is used
3. Enable debug output: `DEBUG=webssh2:envConfig`
4. Check for typos in boolean values (`true`/`false`)

### Array Parsing Issues  

1. Use comma-separated format for simple values
2. Use JSON format for complex values or special characters
3. Escape quotes properly in shell environments

### Algorithm Configuration Problems

1. Use presets (`modern`, `legacy`, `strict`) for simplicity
2. Individual algorithms must be valid SSH algorithm names
3. Check SSH2 library documentation for supported algorithms
4. Individual algorithm variables override preset values - use this to extend presets with legacy algorithms

## Support

For issues with environment variable configuration:

1. Enable debug output: `DEBUG=webssh2:*`
2. Check the configuration validation output
3. Review this documentation for correct variable names and formats
4. Test with minimal configuration first
