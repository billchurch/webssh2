# Configuration Overview

[← Back to Configuration](../configuration/) | [← Back to Documentation](../)

## Configuration Methods

WebSSH2 supports multiple configuration methods with a clear priority order, following the [12-Factor App](https://12factor.net/config) methodology.

## Configuration Priority

Configuration is loaded with the following priority (highest to lowest):

1. **Environment Variables** (highest priority)
2. **config.json file** 
3. **Built-in defaults** (lowest priority)

This means environment variables always override config.json settings, which in turn override defaults.

## Configuration Methods Comparison

| Method | Best For | Pros | Cons |
|--------|----------|------|------|
| Environment Variables | Production, Docker, K8s | Secure, 12-factor compliant, no file management | Can be verbose for complex configs |
| config.json | Development, complex configs | Easy to read, supports comments, version control | Requires file management, less secure |
| URL Parameters | Per-connection customization | Dynamic, user-specific | Limited scope, visible in logs |

## Quick Start

### Using Environment Variables (Recommended)

```bash
# Basic configuration
export WEBSSH2_LISTEN_PORT=3000
export WEBSSH2_SSH_HOST=default.ssh.server
export WEBSSH2_HEADER_TEXT="Production WebSSH2"

# Start the server
npm start
```

### Using config.json

```json
{
  "listen": {
    "port": 3000
  },
  "ssh": {
    "host": "default.ssh.server"
  },
  "header": {
    "text": "Production WebSSH2"
  }
}
```

### Using URL Parameters

```
http://localhost:2222/ssh?port=22&header=Development
```

## Environment Variable Format

All WebSSH2 environment variables follow a consistent naming pattern:

```
WEBSSH2_<SECTION>_<SUBSECTION>_<SETTING>
```

Examples:
- `WEBSSH2_LISTEN_PORT` → `listen.port`
- `WEBSSH2_SSH_ALGORITHMS_KEX` → `ssh.algorithms.kex`
- `WEBSSH2_SESSION_COOKIE_SECRET` → `session.cookie.secret`

## Common Configuration Scenarios

### Development Setup

```bash
# Enable debugging
export DEBUG="webssh2:*"
export WEBSSH2_LISTEN_PORT=3000
export WEBSSH2_HTTP_ORIGINS="http://localhost:*"

npm run dev
```

### Docker Production

```dockerfile
ENV WEBSSH2_LISTEN_PORT=2222
ENV WEBSSH2_SSH_ALGORITHMS_PRESET=modern
ENV WEBSSH2_SESSION_SECRET="strong-random-secret"
ENV WEBSSH2_HTTP_ORIGINS="https://yourdomain.com"
ENV WEBSSH2_LOG_LEVEL=info
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: webssh2-config
data:
  WEBSSH2_LISTEN_PORT: "2222"
  WEBSSH2_SSH_HOST: "bastion.internal"
  WEBSSH2_HEADER_TEXT: "K8s WebSSH2"
  WEBSSH2_HTTP_ORIGINS: "https://*.yourdomain.com"
```

## Configuration Categories

### 1. Server Configuration

Controls how the WebSSH2 server runs:
- Listen address and port
- SSL/TLS settings
- Logging configuration

[Learn more →](./ENVIRONMENT-VARIABLES.md#server-configuration)

### 2. SSH Configuration

SSH connection defaults and algorithms:
- Default host and port
- Algorithm presets (modern, legacy, default)
- Authentication methods
- Environment variable forwarding

[Learn more →](./ENVIRONMENT-VARIABLES.md#ssh-configuration)

### 3. Session Configuration

Web session management:
- Session secret
- Cookie settings
- Timeout values

[Learn more →](./ENVIRONMENT-VARIABLES.md#session-configuration)

### 4. UI Configuration

User interface customization:
- Header text and styling
- Terminal defaults
- Theme settings

[Learn more →](./ENVIRONMENT-VARIABLES.md#header-configuration)

### 5. Security Configuration

Security-related settings:
- CORS origins
- SSO integration
- HTTPS enforcement

[Learn more →](./ENVIRONMENT-VARIABLES.md#security-configuration)

## Best Practices

### 1. Use Environment Variables in Production

```bash
# Good: Secure, no files to manage
export WEBSSH2_SESSION_SECRET="${SECRET_FROM_VAULT}"

# Avoid: Secrets in files
echo '{"session":{"secret":"hardcoded"}}' > config.json
```

### 2. Validate Configuration

Always validate your configuration:

```bash
# Check environment variables
env | grep WEBSSH2_

# Test configuration loading
DEBUG=webssh2:config npm start
```

### 3. Use Presets for SSH Algorithms

Instead of configuring individual algorithms:

```bash
# Good: Use preset
export WEBSSH2_SSH_ALGORITHMS_PRESET=modern

# Avoid: Manual algorithm configuration (unless needed)
export WEBSSH2_SSH_ALGORITHMS_KEX="curve25519-sha256,..."
```

### 4. Secure Your Secrets

```bash
# Use secret management
export WEBSSH2_SESSION_SECRET="$(vault read -field=secret secret/webssh2)"

# Never commit secrets
echo "config.json" >> .gitignore
```

### 5. Document Your Configuration

Create a `.env.example` file:

```bash
# .env.example
WEBSSH2_LISTEN_PORT=2222
WEBSSH2_SSH_HOST=ssh.example.com
WEBSSH2_SESSION_SECRET=change-this-secret
WEBSSH2_HTTP_ORIGINS=https://yourdomain.com
```

## Migration Guide

### From config.json to Environment Variables

**Old (config.json):**
```json
{
  "listen": {
    "port": 3000
  },
  "ssh": {
    "host": "ssh.example.com",
    "port": 22
  }
}
```

**New (Environment Variables):**
```bash
export WEBSSH2_LISTEN_PORT=3000
export WEBSSH2_SSH_HOST=ssh.example.com
export WEBSSH2_SSH_PORT=22
```

### From v1.x to v2.x

See [Breaking Changes](../reference/BREAKING-CHANGES.md) for migration details.

## Configuration Validation

WebSSH2 validates configuration on startup:

1. **Type checking** - Ensures correct data types
2. **Range validation** - Checks port numbers, timeouts
3. **Format validation** - Validates URLs, email addresses
4. **Dependency checking** - Ensures related settings are compatible

Invalid configuration will prevent startup with clear error messages.

## Troubleshooting Configuration

### Configuration Not Loading

1. Check environment variable names (must start with `WEBSSH2_`)
2. Verify config.json location (`./config.json`)
3. Enable debug mode: `DEBUG=webssh2:config npm start`

### Precedence Issues

Remember the priority order:
1. URL parameters (for applicable settings)
2. Environment variables
3. config.json
4. Defaults

### Type Conversion

Environment variables are strings. WebSSH2 automatically converts:
- `"true"`/`"false"` → boolean
- `"123"` → number
- `'["a","b"]'` → array
- `'{"a":"b"}'` → object

## Related Documentation

- [Environment Variables Reference](./ENVIRONMENT-VARIABLES.md)
- [config.json Schema](./CONFIG-JSON.md)
- [URL Parameters](./URL-PARAMETERS.md)
- [Constants](./CONSTANTS.md)
- [Breaking Changes](../reference/BREAKING-CHANGES.md)