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
| `headerStyle` | string | - | Additional inline CSS styles |
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

WebSSH2 supports comprehensive header customization through URL parameters, with two approaches: **enhanced headerStyle** (recommended) and **legacy headerBackground** (backward compatible).

#### Header Text

Override the default header text shown at the top of the terminal:

```
?header=Development%20Server
?header=WebSSH2%20-%20Production
?header=🚨%20PRODUCTION%20-%20CRITICAL%20🚨
```

**Note:** Use URL encoding for spaces and special characters. Emojis are supported.

#### Enhanced Header Styling (headerStyle) - Recommended

The `headerStyle` parameter provides complete control over header appearance using Tailwind CSS classes or CSS properties:

##### Basic Examples

```
# Enhanced background with custom height and text
?header=Production&headerStyle=bg-red-600%20h-10%20text-xl%20font-bold

# Gradient with custom styling
?header=Staging&headerStyle=bg-gradient-to-r%20from-blue-500%20to-purple-500%20h-8%20text-lg

# Custom text colors and shadows
?header=Development&headerStyle=bg-green-500%20text-black%20font-semibold%20shadow-lg
```

##### Backgrounds & Gradients

```
# Multi-directional gradients
?headerStyle=bg-gradient-to-br%20from-purple-600%20via-pink-500%20to-yellow-400%20h-12

# Solid colors with transparency
?headerStyle=bg-blue-500%20h-8%20shadow-blue-500/50

# Complex gradient patterns
?headerStyle=bg-gradient-to-r%20from-red-500%20via-yellow-500%20to-green-500%20h-10
```

##### Typography & Layout

```
# Large headers with custom fonts
?headerStyle=bg-slate-700%20h-16%20text-3xl%20font-black%20flex%20items-center%20justify-center

# Compact headers
?headerStyle=bg-indigo-600%20h-5%20text-xs%20font-medium

# Custom text alignment and colors
?headerStyle=bg-gradient-to-r%20from-cyan-400%20to-blue-500%20text-left%20text-yellow-100%20px-4
```

##### Borders & Effects

```
# Styled borders
?headerStyle=bg-purple-500%20border-2%20border-white%20border-dashed%20h-8

# Shadow effects
?headerStyle=bg-green-500%20shadow-xl%20shadow-green-500/50%20rounded-lg%20h-10

# Rounded corners
?headerStyle=bg-gradient-to-r%20from-pink-400%20to-rose-500%20rounded-xl%20h-12%20mx-2
```

##### Animations

```
# Pulsing effect for alerts
?headerStyle=bg-red-600%20animate-pulse%20h-8%20font-bold

# Bouncing for urgent notifications
?headerStyle=bg-yellow-500%20animate-bounce%20h-10%20text-black%20font-semibold
```

##### Production Examples

```
# Critical system warning
?header=🚨%20PRODUCTION%20-%20CRITICAL%20🚨&headerStyle=bg-gradient-to-r%20from-red-600%20to-red-700%20h-12%20text-2xl%20font-bold%20animate-pulse%20shadow-lg

# Development environment
?header=🛠️%20Development%20Environment&headerStyle=bg-gradient-to-r%20from-green-400%20to-emerald-600%20h-8%20text-white%20font-medium

# Staging deployment
?header=🚀%20Staging%20Deployment&headerStyle=bg-gradient-to-r%20from-yellow-400%20to-orange-500%20h-10%20text-black%20font-semibold%20border-b-2%20border-orange-600

# Secure connection
?header=🔐%20Encrypted%20Connection&headerStyle=bg-gradient-to-r%20from-emerald-500%20to-teal-600%20h-8%20text-white%20shadow-md
```

#### Legacy Header Background (headerBackground)

For backward compatibility, the original `headerBackground` parameter is still supported:

```
# Basic colors
?header=Production&headerBackground=red
?header=Custom&headerBackground=%23ff6b35

# Tailwind classes
?header=Server%20Alpha&headerBackground=bg-blue-500
?header=Critical%20System&headerBackground=bg-red-600

# Simple gradients
?header=Gradient%20Demo&headerBackground=bg-gradient-to-r%20from-blue-500%20to-purple-500
```

#### Header Styling Reference

##### Available Tailwind Classes

**Background Colors & Gradients**
```
# Solid Colors
bg-red-500, bg-red-600, bg-blue-500, bg-blue-600, bg-green-500, bg-yellow-500
bg-purple-500, bg-pink-500, bg-indigo-500, bg-cyan-500, bg-emerald-500, bg-slate-700

# Gradient Directions
bg-gradient-to-r (right), bg-gradient-to-l (left), bg-gradient-to-t (top), bg-gradient-to-b (bottom)
bg-gradient-to-tr (top-right), bg-gradient-to-tl (top-left), bg-gradient-to-br (bottom-right), bg-gradient-to-bl (bottom-left)

# Gradient Colors (use with from/via/to)
from-{color}-{shade}, via-{color}-{shade}, to-{color}-{shade}
```

**Text Styling**
```
# Sizes: text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, text-4xl
# Weights: font-normal, font-medium, font-semibold, font-bold, font-black
# Colors: text-white, text-black, text-yellow-100, text-blue-100, etc.
# Alignment: text-center, text-left
```

**Header Heights**
```
h-4 (16px), h-5 (20px), h-6 (24px), h-7 (28px), h-8 (32px)
h-10 (40px), h-12 (48px), h-14 (56px), h-16 (64px)
```

**Visual Effects**
```
# Animations: animate-pulse, animate-bounce
# Shadows: shadow, shadow-md, shadow-lg, shadow-xl
# Borders: border, border-2, border-4, border-{color}-{shade}
# Border styles: border-dashed, border-solid
# Border radius: rounded, rounded-lg, rounded-xl
```

**Layout & Positioning**
```
# Text alignment: text-left, text-center
# Padding: px-2, px-4, px-6 (horizontal), py-1, py-2, py-3 (vertical)
# Flexbox: flex items-center justify-center
```

##### Common Use Cases

**Production/Critical Systems**
```
# Red gradient with large text and pulsing animation
bg-gradient-to-r from-red-600 to-red-700 h-12 text-2xl font-bold animate-pulse

# Solid red with white border
bg-red-600 border-2 border-white h-10 text-xl font-bold
```

**Staging/Development**
```
# Yellow-orange gradient for staging
bg-gradient-to-r from-yellow-400 to-orange-500 h-10 text-black font-semibold

# Green for development
bg-gradient-to-r from-green-400 to-emerald-600 h-8 text-white font-medium
```

**Secure/Special Connections**
```
# Blue gradient with shadow
bg-gradient-to-r from-blue-500 to-cyan-500 h-8 shadow-lg

# Purple with rounded corners
bg-purple-600 rounded-lg h-10 font-semibold
```

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

```
http://localhost:2222/ssh/host/prod-server?header=PRODUCTION&headerBackground=red&headerStyle=color:%20white;%20font-weight:%20bold;%20text-transform:%20uppercase
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