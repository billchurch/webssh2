# API Routes

[← Back to API](../api/) | [← Back to Documentation](../)

## Overview

WebSSH2 provides several HTTP routes for different authentication methods and utility functions.

## Main Routes

### 1. `/ssh` - Interactive Login

- **URL:** `http(s)://your-webssh2-server/ssh`
- **Method:** GET
- **Features:**
  - Interactive login form
  - Terminal configuration options
  - Supports both password and private key authentication

**Screenshots:**

Login Form:
<img width="341" alt="Login Form" src="https://github.com/user-attachments/assets/829d1776-3bc5-4315-b0c6-9e96a648ce06">

Terminal Configuration:
<img width="341" alt="Terminal Configuration" src="https://github.com/user-attachments/assets/bf60f5ba-7221-4177-8d64-946907aed5ff">

### 2. `/ssh/host/:host` - HTTP Basic Auth ⚠️ **DEPRECATED**

> **⚠️ DEPRECATION NOTICE:** HTTP Basic Authentication is deprecated and may be removed in a future version. We strongly recommend using **HTTP POST Authentication** for SSO integration and modern authentication workflows.

- **URL:** `http(s)://your-webssh2-server/ssh/host/:host`
- **Method:** GET
- **Authentication:** HTTP Basic Auth (deprecated)
- **Status:** Still functional but deprecated
- **Features:**
  - Quick connections to specific hosts
  - Optional `port` parameter (e.g., `?port=2222`)
- **Migration:** Use POST authentication for new implementations

#### HTTP Basic Auth Behavior

WebSSH2 validates SSH credentials immediately upon receiving HTTP Basic Auth credentials. This ensures only valid SSH credentials proceed to the terminal interface.

**Expected Behavior:**

1. **URL without embedded credentials:**
   ```
   http://localhost:2222/ssh/host/example.com
   ```
   - Invalid credentials → 401 Unauthorized
   - Browser shows auth dialog
   - User can enter correct credentials
   - Success

2. **URL with embedded credentials:**
   ```
   http://user:pass@localhost:2222/ssh/host/example.com
   ```
   - Browser always uses URL credentials
   - Never prompts for new ones
   - Invalid credentials → 401 Unauthorized
   - No re-authentication possible
   - User must manually remove bad credentials from URL to retry

**Important:** This is standard HTTP Basic Auth behavior. URLs with embedded credentials take absolute precedence over HTTP auth dialogs. For interactive re-authentication on failure, use URLs without embedded credentials.

### 3. `/ssh` - HTTP POST Auth ✅ **RECOMMENDED**

- **URL:** `http(s)://your-webssh2-server/ssh`
- **Method:** POST
- **Content-Type:** `application/json`
- **Status:** Recommended for SSO and modern authentication
- **Features:**
  - Clean separation from Basic Auth routes
  - Better integration with SSO systems (SAML, OAuth)
  - More secure credential handling
  - Compatible with CSRF protection
  - Supports complex authentication flows
  - Better suited for programmatic access
  - No session credential conflicts

#### Request Body

```json
{
  "username": "string",        // Required
  "password": "string",        // Required
  "host": "string",           // Required
  "port": 22,                 // Optional (default: 22)
  "sshterm": "xterm-256color" // Optional
}
```

#### Example: Basic POST Request

```bash
curl -X POST "http://localhost:2222/ssh" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "myuser",
    "password": "mypass",
    "host": "example.com",
    "port": 22,
    "sshterm": "xterm-256color"
  }'
```

#### Example: SSO Integration

```javascript
// SAML/OAuth → WebSSH2 integration
const response = await fetch('/ssh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ssoToken}`
  },
  body: JSON.stringify({
    username: await getSSOUsername(ssoToken),
    password: await getSSOPassword(ssoToken),
    host: targetHost,
    port: 22
  })
});
```

## Utility Routes

### `/ssh/reauth` - Clear Session and Re-authenticate

- **URL:** `http(s)://your-webssh2-server/ssh/reauth`
- **Method:** GET
- **Purpose:** Clears all stored session credentials and redirects to fresh login
- **Use Case:** When credentials are stuck or you need to force re-authentication
- **Behavior:** Clears session and redirects to `/ssh`
- **Response:** 302 Redirect to `/ssh`

### `/ssh/clear-credentials` - Clear Credentials Only

- **URL:** `http(s)://your-webssh2-server/ssh/clear-credentials`
- **Method:** GET
- **Purpose:** Clears stored SSH credentials from session
- **Response:** 200 OK with body: `"Credentials cleared"`

### `/ssh/force-reconnect` - Force Re-authentication

- **URL:** `http(s)://your-webssh2-server/ssh/force-reconnect`
- **Method:** GET
- **Purpose:** Clears credentials and returns 401 Unauthorized
- **Response:** 401 Unauthorized with body: `"Authentication required"`

## Query Parameters

All routes support the following query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `port` | integer | 22 | SSH port to connect to |
| `sshterm` | string | xterm-color | Terminal type |
| `header` | string | - | Header text override |
| `headerBackground` | string | green | Header background color |
| `headerStyle` | string | - | Additional inline styles (e.g., `color: red`) |
| `env` | string | - | Comma-separated env pairs (e.g., `FOO:bar,BAR:baz`) |

### Example with Query Parameters

```
http://localhost:2222/ssh/host/example.com?port=2244&sshterm=xterm-256color&env=DEBUG:true,NODE_ENV:production
```

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 302 | Redirect (for reauth) |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (authentication required or failed) |
| 404 | Not Found (invalid route) |
| 500 | Internal Server Error |

## Migration Guide

### From Basic Auth to POST Auth

**Old Method (Deprecated):**
```javascript
// Using Basic Auth
window.location.href = 'http://user:pass@server:2222/ssh/host/example.com';
```

**New Method (Recommended):**
```javascript
// Using POST Auth
fetch('/ssh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'user',
    password: 'pass',
    host: 'example.com',
    port: 22
  })
});
```

## Security Considerations

1. **Always use HTTPS** in production to protect credentials in transit
2. **POST authentication** is more secure than Basic Auth
3. **Avoid embedding credentials** in URLs
4. **Use SSO integration** when possible for enterprise deployments
5. **Configure CORS properly** via `http.origins` configuration

## Related Documentation

- [Authentication Overview](../features/AUTHENTICATION.md)
- [WebSocket API](./WEBSOCKET-API.md)
- [URL Parameters](../configuration/URL-PARAMETERS.md)
- [SSO Integration](../features/SSO.md)