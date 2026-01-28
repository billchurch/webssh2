# WebSSH2 Authentication Documentation

## Overview

WebSSH2 supports multiple authentication methods depending on the route used. This document covers the authentication behavior and important considerations for each approach.

## Authentication Routes

### 1. Interactive Authentication (`/ssh`)

- **URL:** `http(s)://your-webssh2-server/ssh`
- **Method:** Interactive web form
- **Features:**
  - User fills out connection form in browser
  - Supports password and private key authentication
  - Flexible credential input
  - No pre-authentication required

### 2. HTTP Basic Authentication (`/ssh/host/:host`) - **DEPRECATED**

> **⚠️ DEPRECATION NOTICE:** HTTP Basic Authentication is deprecated and may be removed in a future version. We strongly recommend using **HTTP POST Authentication** for SSO integration and modern authentication workflows.

- **URL:** `http(s)://your-webssh2-server/ssh/host/:host`
- **Method:** HTTP Basic Auth
- **Status:** Deprecated but still functional
- **Features:**
  - Quick connections to specific hosts
  - Immediate SSH credential validation
  - Standard HTTP authentication flow
- **Migration:** Use HTTP POST Authentication for new implementations

### 3. HTTP POST Authentication (`/ssh`) - **RECOMMENDED**

- **URL:** `http(s)://your-webssh2-server/ssh`
- **Method:** HTTP POST with credentials in request body
- **Status:** Recommended for SSO and modern authentication
- **Features:**
  - Clean separation from Basic Auth routes (no session conflicts)
  - Better integration with SSO systems
  - More secure credential handling
  - Compatible with CSRF protection
  - Supports complex authentication flows
  - Better suited for programmatic access
  - Flexible parameter passing (body and/or query params)

#### Parameter Flexibility

POST authentication supports flexible parameter passing:

- **Required in body:** `username`, `password`
- **Optional (body or query):** `host`/`hostname`, `port`, `sshterm`
- **Precedence:** Body parameters override query parameters

This allows SSO systems to:
1. Send credentials securely in POST body
2. Specify target host via URL query parameters
3. Mix and match based on security requirements

## HTTP Basic Auth Behavior (Critical Information)

WebSSH2 validates SSH credentials **immediately** upon receiving HTTP Basic Auth credentials. This ensures only valid SSH credentials proceed to the terminal interface.

### Expected Behavior Patterns

#### 1. URL Without Embedded Credentials

**URL Format:** `http://localhost:2222/ssh/host/example.com`

**Flow:**
1. User navigates to URL
2. Browser prompts for credentials (if not cached)
3. WebSSH2 validates SSH credentials immediately
4. **Invalid credentials** → 401 Unauthorized → Browser shows auth dialog → User can enter correct credentials → Success
5. **Valid credentials** → 200 OK → Terminal interface loads

#### 2. URL With Embedded Credentials

**URL Format:** `http://user:pass@localhost:2222/ssh/host/example.com`

**Flow:**
1. Browser automatically uses embedded credentials
2. WebSSH2 validates SSH credentials immediately
3. **Invalid credentials** → 401 Unauthorized → **No re-authentication possible**
4. **Valid credentials** → 200 OK → Terminal interface loads

**⚠️ Important Limitation:** Browsers will **never** prompt for new credentials when they are embedded in the URL, even on 401 responses. Users must manually remove bad credentials from the URL to retry.

### Why This Behavior Exists

This is **standard HTTP Basic Auth behavior**, not a WebSSH2 limitation:

- **URLs with embedded credentials** take absolute precedence over HTTP auth dialogs
- **RFC 3986** defines this as the expected behavior for user info in URLs
- **Security consideration**: Prevents credentials from being cached or persisted inappropriately

### Implementation Details

WebSSH2 performs immediate SSH validation in the route handlers (`app/routes.ts`) and returns appropriate HTTP status codes based on the failure type:

```javascript
// Validate SSH credentials before serving client
const validationResult = await validateSshCredentials(host, port, username, password, config)

if (!validationResult.success) {
  switch (validationResult.errorType) {
    case 'auth':
      // Authentication failed - allow re-authentication
      res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH2"')
      return res.status(401).send('SSH authentication failed')
    case 'network':
      // Network/connectivity issue - no point in re-authenticating
      return res.status(502).send(`Bad Gateway: Unable to connect to SSH server`)
    case 'timeout':
      // Connection timeout
      return res.status(504).send(`Gateway Timeout: SSH connection timed out`)
    default:
      // Unknown error
      return res.status(502).send(`Bad Gateway: SSH connection failed`)
  }
}
```

#### HTTP Status Codes Used

- **401 Unauthorized**: Invalid SSH credentials (authentication failure)
  - Browser will prompt for new credentials (if not embedded in URL)
  - Indicates credentials are wrong and re-authentication might help

- **502 Bad Gateway**: Network/connectivity issues
  - Host doesn't exist (DNS failure)
  - Connection refused (port closed)
  - Network unreachable
  - Re-authentication won't help - it's an infrastructure problem

- **504 Gateway Timeout**: SSH connection timeout
  - Host is unreachable (no response)
  - Connection attempt timed out
  - Re-authentication won't help

This approach:
- ✅ Prevents invalid credentials from reaching WebSocket layer
- ✅ Provides immediate feedback on authentication failures
- ✅ Follows HTTP standards for proper status codes
- ✅ Differentiates between auth failures and network issues
- ✅ Prevents unnecessary re-authentication attempts for network problems

#### Error Response Format

WebSSH2 uses content negotiation to provide appropriate error responses:

**Browser Requests** (`Accept: text/html`):
- Returns a styled HTML error page
- Shows error title, message, and connection details
- Includes "Try Again" button for 401 errors

**API Requests** (`Accept: application/json`):
- Returns JSON with error details:
  ```json
  {
    "error": "Authentication failed",
    "message": "All configured authentication methods failed",
    "host": "example.com",
    "port": 22
  }
  ```

This ensures browsers display user-friendly error pages while API clients receive machine-readable JSON.

## Migration Guide: Basic Auth → POST Auth

### Why Migrate?

- **SSO Integration:** POST auth works better with SAML, OAuth, and other SSO systems
- **Security:** More secure credential handling with CSRF protection
- **Programmatic Access:** Better suited for API integration and automation
- **Future-Proof:** Basic Auth support may be removed in future versions

### Migration Examples

#### Before (Basic Auth - Deprecated)
```bash
# Browser-based
curl -u "username:password" "http://localhost:2222/ssh/host/example.com"

# URL-embedded
curl "http://username:password@localhost:2222/ssh/host/example.com"
```

#### After (POST Auth - Recommended)
```bash
# Standard POST request - all parameters in body
curl -X POST "http://localhost:2222/ssh" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "myuser",
    "password": "mypass",
    "host": "example.com",
    "port": 22
  }'

# Mixed mode - credentials in body, host/port in query params
curl -X POST "http://localhost:2222/ssh?host=example.com&port=22" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "myuser",
    "password": "mypass"
  }'

# With additional parameters
curl -X POST "http://localhost:2222/ssh?sshterm=xterm-256color" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "myuser", 
    "password": "mypass",
    "host": "example.com",
    "port": 22
  }'
```

### SSO Integration with POST Auth

POST authentication is ideal for SSO systems:

```javascript
// Example: SAML/OAuth → WebSSH2 integration
async function authenticateWithSSO(ssoToken, targetHost, targetPort = 22) {
  // Option 1: All parameters in body
  const response = await fetch('/ssh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ssoToken}` // Your SSO token
    },
    body: JSON.stringify({
      username: await getSSOUsername(ssoToken),
      password: await getSSOPassword(ssoToken),
      host: targetHost,
      port: targetPort
    })
  });
  
  // Option 2: Mix body and query params (more secure - host not in body)
  const params = new URLSearchParams({ host: targetHost, port: targetPort });
  const response2 = await fetch(`/ssh?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ssoToken}`
    },
    body: JSON.stringify({
      username: await getSSOUsername(ssoToken),
      password: await getSSOPassword(ssoToken)
    })
  });
  
  if (response.ok) {
    // Redirect to WebSSH2 terminal
    window.location.href = response.url;
  }
}
```

## Best Practices

### For Users

1. **For interactive re-authentication:** Use URLs without embedded credentials
   ```
   ✅ Good: http://localhost:2222/ssh/host/example.com
   ❌ Problematic: http://user:pass@localhost:2222/ssh/host/example.com
   ```

2. **For scripted/automated access:** Embed credentials in URL (no retry needed)
   ```
   ✅ Good: http://validuser:validpass@localhost:2222/ssh/host/example.com
   ```

3. **For development/testing:** Always test authentication flows with clean URLs first

### For Administrators

1. **Always use HTTPS** when transmitting credentials via HTTP Basic Auth
2. **Configure proper SSL/TLS** to protect credential transmission
3. **Monitor logs** for authentication failures to identify issues
4. **Document** this behavior for users to prevent confusion

## Troubleshooting

### "Credentials not working after 401"

**Symptom:** User enters wrong credentials, gets 401, enters correct credentials, but still getting 401

**Cause:** Credentials are embedded in URL - browser is not using new credentials

**Solution:** Have user manually edit URL to remove `user:pass@` portion

### "Browser not prompting for credentials"

**Symptom:** 401 response but no authentication dialog appears

**Causes & Solutions:**
1. **Embedded credentials in URL** → Remove credentials from URL
2. **Browser cached credentials** → Clear browser auth cache or use incognito mode
3. **CORS issues** → Check server CORS configuration

### "Authentication works in browser but not in scripts"

**Symptom:** Manual browser access works, but curl/scripts fail

**Solution:** Ensure scripts are properly encoding credentials and handling 401 responses

**Example curl command:**
```bash
curl -u "username:password" "http://localhost:2222/ssh/host/example.com"
```

## Technical Reference

### HTTP Response Codes

- **200 OK**: SSH credentials valid, terminal interface served
- **401 Unauthorized**: SSH credentials invalid, includes `WWW-Authenticate` header
- **400 Bad Request**: Malformed request or invalid parameters
- **500 Internal Server Error**: Server-side issues
- **502 Bad Gateway**: SSH server unreachable (network/DNS issues)
- **504 Gateway Timeout**: SSH connection timed out

### Headers

**401 Response Headers:**
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="WebSSH2"
```

### Debug Logging

Enable debug logging to trace authentication flow:

```bash
DEBUG=webssh2:routes npm start
```

Look for log entries like:
- `Validating SSH credentials for user@host:port`
- `SSH validation successful for user@host:port`
- `SSH validation failed for user@host:port`

## Related Documentation

- [CONFIG.md](CONFIG.md) - Server configuration options
- [SERVER_API.md](SERVER_API.md) - WebSocket API documentation
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development and testing guidelines