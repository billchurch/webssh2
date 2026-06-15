# URL Parameters Configuration

[← Back to Configuration](../configuration/) | [← Back to Documentation](../)

## Overview

WebSSH2 supports configuration through URL query parameters, allowing you to customize connections without modifying server configuration. These parameters can be used with both `/ssh` and `/ssh/host/:host` routes.

## Supported Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `port` | integer | 22 | SSH port to connect to |
| `sshterm` | string | xterm-color | Terminal type for the SSH session |
| `header` | string | - | Override the header text |
| `headerBackground` | string | green | Header background color |
| `env` | string | - | Environment variables for SSH session |

## Usage Examples

### Basic Connection

```
http://localhost:2222/ssh/host/example.com
```

### Custom Port

```
http://localhost:2222/ssh/host/example.com?port=2244
```

### Multiple Parameters

```
http://localhost:2222/ssh/host/example.com?port=2244&sshterm=xterm-256color
```

### With Interactive Login

```
http://localhost:2222/ssh?port=22&header=Production%20Server
```

## Parameter Details

### Port

Specifies the SSH port on the target server.

```
?port=2222
?port=8022
```

**Note:** Must be a valid port number (1-65535).

### SSH Terminal Type

Sets the terminal type for the SSH session. This affects how the terminal displays colors and special characters.

Common values:

- `xterm-color` (default)
- `xterm-256color` (256 color support)
- `xterm`
- `vt100`
- `linux`
- `screen`
- `screen-256color`

```
?sshterm=xterm-256color
```

### Header Customization

The header bar displays an optional label above the terminal.
Two URL parameters control it:

- `header` — display text (max 100 characters, control characters stripped)
- `headerBackground` — CSS color for the bar background.
  Validated against `^[a-zA-Z0-9#(),.\s-]+$`.
  Hex (`#ff00aa`), rgb/rgba (`rgb(0, 0, 0)`), named colors
  (`red`, `transparent`) are accepted. Invalid values fall back to `#000`.

#### Header and Background Usage

Override the default header text shown at the top of the terminal:

```text
?header=Development%20Server
?header=WebSSH2%20-%20Production
```

**Note:** Use URL encoding for spaces and special characters.

##### Examples

```text
?header=Production&headerBackground=#dc2626
?header=Staging&headerBackground=rgb(59,130,246)
?headerBackground=transparent
```

For gradients, animation, or layout customization beyond a solid background
color, use the terminal theming feature.

#### Migrating from `headerStyle`

The `headerStyle` URL parameter and `header.color` POST field were removed in
[issue #102](https://github.com/billchurch/webssh2_client/issues/102).
Both are now silently ignored. To replace them:

| Old usage | Replacement |
| --- | --- |
| Solid background color (`headerStyle=bg-red-600`) | `?headerBackground=#dc2626` or `WEBSSH2_HEADER_BACKGROUND` |
| Custom text (`headerStyle=...` with no color intent) | `?header=Production` or `WEBSSH2_HEADER_TEXT` |
| Gradients / animation / advanced layout | Terminal theming |
| `header.color` POST field | `header.background` POST (validated CSS color) |

These parameters were non-functional in shipped releases prior to
[`webssh2#519`](https://github.com/billchurch/webssh2/pull/519),
so this change has no behavior impact on production deployments
that already relied on what was rendered.

### Environment Variables

Pass environment variables to the SSH session:

```
?env=DEBUG:true
?env=NODE_ENV:production,DEBUG:true
?env=FOO:bar,BAR:baz,QUX:123
```

Format: `KEY:value,KEY2:value2`

**Important:**

- Variable names must match the pattern `^[A-Z][A-Z0-9_]*$`
- Values cannot contain shell special characters
- SSH server must allow variables via `AcceptEnv`
- See [Environment Forwarding](../features/ENVIRONMENT-FORWARDING.md) for details

## Complex Examples

### Development Environment

```
http://localhost:2222/ssh/host/dev-server?port=22&sshterm=xterm-256color&header=DEV&headerBackground=orange&env=NODE_ENV:development,DEBUG:*
```

### Production Server with Custom Styling

```text
http://localhost:2222/ssh/host/prod-server?header=PRODUCTION&headerBackground=%23dc2626
```

### Testing Environment with Debugging

```
http://localhost:2222/ssh?port=2244&env=DEBUG:webssh2:*,LOG_LEVEL:debug&header=TEST%20SERVER&headerBackground=%23FFA500
```

## URL Encoding

Special characters must be URL-encoded:

| Character | Encoded |
|-----------|---------|
| Space | `%20` |
| `#` | `%23` |
| `:` | `%3A` |
| `;` | `%3B` |
| `=` | `%3D` |
| `&` | `%26` |

### Encoding Examples

Original: `color: white; font-weight: bold`
Encoded: `color:%20white;%20font-weight:%20bold`

Original: `#FF5733`
Encoded: `%23FF5733`

## Best Practices

1. **Use URL encoding** for all special characters
2. **Test terminal types** to ensure compatibility with your applications
3. **Limit header text length** to avoid UI issues
4. **Validate environment variables** match server's `AcceptEnv` configuration
5. **Use HTTPS** in production to protect URL parameters

## Common Issues

### Parameters Not Applied

- Ensure proper URL encoding
- Check parameter names are spelled correctly
- Verify values are in the correct format

### Environment Variables Not Working

- Check SSH server's `AcceptEnv` configuration
- Verify variable name format (uppercase, alphanumeric)
- Ensure no shell special characters in values

### Header Styling Issues

- URL-encode all CSS properties
- Use valid CSS syntax
- Test color values in different formats

## Security Considerations

1. **URL parameters are visible** in browser history and server logs
2. **Don't pass sensitive data** via URL parameters
3. **Use POST authentication** for credentials
4. **Configure allowlists** for environment variables
5. **Validate all inputs** on the server side

## Related Documentation

- [Environment Forwarding](../features/ENVIRONMENT-FORWARDING.md)
- [Routes API](../api/ROUTES.md)
- [Configuration Overview](./OVERVIEW.md)
- [Environment Variables](./ENVIRONMENT-VARIABLES.md)
