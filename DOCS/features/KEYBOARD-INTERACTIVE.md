# Keyboard Interactive Authentication

[← Back to Features](../features/) | [← Back to Documentation](../)

## Overview

Keyboard Interactive authentication provides a flexible way to handle various authentication scenarios, including multi-factor authentication.

## How It Works

### 1. Authentication Flow

When the SSH server requests Keyboard Interactive authentication, WebSSH2 can handle it in two ways:
- **Automatically** (default behavior)
- **By prompting the user** through the web interface

### 2. Automatic Mode

In automatic mode:
- If all prompts contain the word "password" (case-insensitive), WebSSH2 will automatically respond using the password provided during the initial connection attempt
- If any prompt doesn't contain "password", all prompts will be forwarded to the web client for user input

### 3. User Prompts

When prompts are sent to the web client:
- A dialog box appears in the user's browser, displaying all prompts from the SSH server
- The user can input responses for each prompt
- Responses are sent back to the SSH server to complete the authentication process

## Configuration

You can customize the Keyboard Interactive authentication behavior using the following option:

### Via config.json

```json
{
  "ssh": {
    "alwaysSendKeyboardInteractivePrompts": false
  }
}
```

### Via Environment Variable

```bash
WEBSSH2_SSH_ALWAYS_SEND_KEYBOARD_INTERACTIVE_PROMPTS=true
```

### Configuration Options

- **`alwaysSendKeyboardInteractivePrompts`** (boolean, default: false)
  - When `true`: All Keyboard Interactive prompts will always be sent to the web client, regardless of their content
  - When `false` (default): WebSSH2 will attempt to automatically handle password prompts and only send non-password prompts to the web client

## Use Cases

### 1. Simple Password Authentication
With default settings, if the SSH server uses Keyboard Interactive for password authentication, WebSSH2 will automatically handle it without additional user interaction.

### 2. Multi-Factor Authentication
For SSH servers requiring additional factors (e.g., OTP), WebSSH2 will present prompts to the user through the web interface.

### 3. Always Prompt User
By setting `alwaysSendKeyboardInteractivePrompts` to `true`, you can ensure that users always see and respond to all authentication prompts, which can be useful for security-sensitive environments or for debugging purposes.

## Security Considerations

- The automatic password handling feature is designed for convenience but may not be suitable for high-security environments
- Consider setting `alwaysSendKeyboardInteractivePrompts` to `true` if you want users to explicitly enter their credentials for each session
- Always use HTTPS to protect the communication between the web browser and the WebSSH2 server

## Technical Reference

For more information on SSH keyboard-interactive authentication, refer to [RFC 4256](https://tools.ietf.org/html/rfc4256).

## Related Documentation

- [Authentication Overview](./AUTHENTICATION.md)
- [Private Key Authentication](./PRIVATE-KEYS.md)
- [SSO Integration](./SSO.md)