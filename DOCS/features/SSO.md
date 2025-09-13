# WebSSH2 SSO Implementation

## Overview

WebSSH2 now supports secure Single Sign-On (SSO) authentication via HTTP POST requests, enabling integration with enterprise SSO solutions like F5 BIG-IP APM. This feature allows external authentication systems to automatically log users into SSH sessions without requiring manual credential entry.

**Security Enhancement**: As of the latest update, WebSSH2 uses **session-only authentication**, meaning all authentication data remains server-side in encrypted sessions.

## Features

- **POST Authentication**: Accept credentials via form-encoded POST requests
- **Header-Based Authentication**: Support for custom headers (e.g., X-APM-Username, X-APM-Password)
- **Session-Only Security**: Credentials never sent to client, stored only in server sessions
- **Zero Credential Exposure**: No passwords, usernames, or keys in HTML/JavaScript
- **Backward Compatibility**: Existing GET routes with Basic Auth remain unchanged
- **Session Management**: Credentials stored securely in HTTPOnly Express sessions
- **CSRF Protection**: Optional CSRF token validation for enhanced security
- **Customizable Headers**: Support for custom terminal headers and styling

## Configuration

WebSSH2 supports SSO configuration through both environment variables (preferred) and `config.json` file. Environment variables take precedence over config.json settings.

### Environment Variables (Preferred)

Configure SSO using the following environment variables:

```bash
# Enable SSO functionality
export WEBSSH2_SSO_ENABLED=true

# Enable CSRF protection (recommended for production)
export WEBSSH2_SSO_CSRF_PROTECTION=true

# Trusted proxy IPs (comma-separated list)
export WEBSSH2_SSO_TRUSTED_PROXIES="10.0.0.1,192.168.1.100"

# Header mapping for credentials
export WEBSSH2_SSO_HEADER_USERNAME="x-apm-username"
export WEBSSH2_SSO_HEADER_PASSWORD="x-apm-password"
export WEBSSH2_SSO_HEADER_SESSION="x-apm-session"
```

### Configuration File (config.json)

Alternatively, add the following configuration to your `config.json`:

```json
{
  "sso": {
    "enabled": true,
    "csrfProtection": false,
    "trustedProxies": ["10.0.0.1", "192.168.1.100"],
    "headerMapping": {
      "username": "x-apm-username",
      "password": "x-apm-password",
      "session": "x-apm-session"
    }
  }
}
```

### Configuration Options

| Option | Environment Variable | Type | Description | Default |
|--------|---------------------|------|-------------|---------|
| `enabled` | `WEBSSH2_SSO_ENABLED` | boolean | Enable/disable SSO functionality | `false` |
| `csrfProtection` | `WEBSSH2_SSO_CSRF_PROTECTION` | boolean | Enable CSRF token validation for POST requests | `false` |
| `trustedProxies` | `WEBSSH2_SSO_TRUSTED_PROXIES` | array/string | IP addresses for trusted proxy servers (bypasses CSRF) | `[]` |
| `headerMapping.username` | `WEBSSH2_SSO_HEADER_USERNAME` | string | Header name for username mapping | `x-apm-username` |
| `headerMapping.password` | `WEBSSH2_SSO_HEADER_PASSWORD` | string | Header name for password mapping | `x-apm-password` |
| `headerMapping.session` | `WEBSSH2_SSO_HEADER_SESSION` | string | Header name for session mapping | `x-apm-session` |

**Note:** Environment variables override config.json settings when both are present.

## API Endpoints

### POST /ssh/host/

Authenticate and connect to the default configured host.

**Request:**
```http
POST /ssh/host/
Content-Type: application/x-www-form-urlencoded

username=john&password=secret123&port=22
```

### POST /ssh/host/:host

Authenticate and connect to a specific host.

**Request:**
```http
POST /ssh/host/myserver.example.com
Content-Type: application/x-www-form-urlencoded

username=john&password=secret123&port=2222
```

### Supported Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `username` | string | SSH username | Yes |
| `password` | string | SSH password | Yes |
| `host` | string | Target SSH server | No (uses URL param or default) |
| `port` | number | SSH port | No (default: 22) |
| `sshterm` | string | Terminal type | No (default: xterm-256color) |
| `header.name` | string | Custom header text | No |
| `header.background` | string | Header background color | No |
| `header.color` | string | Header text color | No |
| `allowreplay` | boolean | Enable session replay | No |
| `mrhsession` | string | Session recording ID | No |
| `readyTimeout` | number | Connection timeout (ms) | No |

## BIG-IP APM Integration

### 1. Configure WebSSO

In BIG-IP APM, create a WebSSO configuration:

1. Navigate to Access > Single Sign-On > Forms-Based
2. Create a new configuration with:
   - Form action: `/ssh/host/*`
   - Username field: `username`
   - Password field: `password`
   - Method: POST

### 2. Map Session Variables

Configure APM to map session variables to form fields:

```
session.logon.last.username → username
session.logon.last.password → password
```

### 3. iRule for Header Injection

For header-based authentication, use this iRule:

```tcl
when HTTP_REQUEST {
    if { [HTTP::uri] starts_with "/ssh/host/" } {
        if { [ACCESS::session exists] } {
            HTTP::header insert "X-APM-Username" \
                [ACCESS::session data get session.logon.last.username]
            HTTP::header insert "X-APM-Password" \
                [ACCESS::session data get session.custom.ssh_password]
        }
    }
}
```

## Example HTML Form

```html
<!DOCTYPE html>
<html>
<head>
    <title>SSH Login</title>
</head>
<body>
    <form action="/ssh/host/myserver.example.com" method="POST">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Password" required>
        <input type="hidden" name="port" value="22">
        <input type="hidden" name="header.name" value="Production Server">
        <input type="hidden" name="header.background" value="red">
        <button type="submit">Connect</button>
    </form>
</body>
</html>
```

## JavaScript Example

```javascript
async function connectSSH(host, credentials) {
    const formData = new URLSearchParams({
        username: credentials.username,
        password: credentials.password,
        port: credentials.port || 22,
        'header.name': `SSH: ${host}`,
        'header.background': 'green'
    });
    
    const response = await fetch(`/ssh/host/${host}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        credentials: 'include'
    });
    
    if (response.ok) {
        window.location.href = response.url;
    } else {
        console.error('Authentication failed');
    }
}
```

## Testing

### Manual Testing

Use the provided test script:

```bash
./examples/test-sso.sh
```

Or test with curl:

```bash
# Test POST authentication
curl -X POST http://localhost:2222/ssh/host/localhost \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=myuser&password=mypass&port=22"

# Test with APM headers
curl -X POST http://localhost:2222/ssh/host/localhost \
  -H "X-APM-Username: myuser" \
  -H "X-APM-Password: mypass" \
  -d "port=22"
```

### Automated Testing

Run the test suite:

```bash
npm test -- tests/post-auth.test.js
```

## Security Architecture

### Session-Only Authentication Flow

1. **Client sends credentials** via POST or Basic Auth
2. **Server validates** and stores in Express session
3. **Server returns HTML** with only connection info (host/port)
4. **Client connects** via WebSocket with session cookie
5. **Server authenticates** using session credentials
6. **SSH connection established** without client-side credentials

### What's Sent to Client

```javascript
// Client receives only:
window.webssh2Config = {
  socket: { url: "...", path: "/ssh/socket.io" },
  ssh: { host: "server.com", port: 22 },
  autoConnect: true
}
// No username, password, or private keys!
```

## Security Considerations

1. **Always use HTTPS** in production to encrypt credentials in transit
2. **Session-only authentication** ensures credentials never reach the browser
3. **HTTPOnly cookies** prevent JavaScript access to session tokens
4. **Enable CSRF protection** when not using trusted proxies
5. **Configure trusted proxies** carefully to prevent unauthorized access
6. **Validate all input** on the server side
7. **Implement rate limiting** to prevent brute force attacks
8. **Log authentication attempts** for security auditing
9. **Use secure session storage** with proper timeout configurations
10. **No credential caching** in browser, proxy, or CDN logs

## Migration Guide

### From Basic Auth to SSO

Existing deployments using Basic Auth will continue to work without changes. To migrate:

1. Enable SSO in configuration
2. Update client applications to use POST instead of GET
3. Remove credentials from URLs
4. Update any custom authentication logic

### Backward Compatibility

All existing routes remain functional:

- `GET /ssh/host/:host` with Basic Auth headers
- WebSocket authentication for interactive login
- URL parameter authentication (not recommended)

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check username/password correctness
2. **403 Forbidden**: CSRF token validation failed
3. **Connection Timeout**: Verify host is reachable
4. **Session Issues**: Clear cookies and retry

### Debug Mode

Enable debug logging:

```bash
DEBUG=webssh2:* npm start
```

### Check SSO Configuration

```javascript
// In browser console
fetch('/ssh/config').then(r => r.json()).then(console.log)
```

## Support

For issues or questions:
- GitHub Issues: [webssh2/issues](https://github.com/billchurch/webssh2/issues)
- Documentation: [webssh2/docs](https://github.com/billchurch/webssh2/tree/main/docs)