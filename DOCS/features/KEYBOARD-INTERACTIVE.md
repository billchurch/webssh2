# Keyboard Interactive Authentication

[← Back to Features](../features/) | [← Back to Documentation](../)

## Overview

Keyboard Interactive authentication provides a flexible way to handle various authentication scenarios, including multi-factor authentication (MFA), two-factor authentication (2FA), and multi-round challenge-response flows.

## How It Works

### 1. Authentication Flow

When the SSH server requests Keyboard Interactive authentication, WebSSH2 handles it through a prompt-response loop that supports:
- **Single-round authentication** (e.g., simple password prompt)
- **Multi-round authentication** (e.g., password followed by 2FA code)
- **Multi-prompt-per-round** (e.g., username and password in one dialog)

### 2. Three Modes of Operation

WebSSH2 supports three modes for handling keyboard-interactive prompts:

#### Mode 1: Default (Auto-password for first round)
- **First round**: If ALL prompts contain "password" (case-insensitive), WebSSH2 automatically responds with the password provided during connection
- **First round with non-password prompts**: All prompts are forwarded to the client for user input
- **Subsequent rounds**: Always forwarded to the client (e.g., 2FA verification codes)

#### Mode 2: Server-wide "Always Forward" Setting
- Set `alwaysSendKeyboardInteractivePrompts: true` in server config
- ALL prompts in ALL rounds are forwarded to the client
- Overrides the default auto-password behavior

#### Mode 3: Per-session "Always Forward" Option
- Client can request to forward all prompts by setting `forwardAllKeyboardInteractivePrompts: true` in the authentication credentials
- Useful for clients that want explicit control over the authentication flow
- Overrides the default auto-password behavior for that session only

### 3. User Prompts

When prompts are forwarded to the web client:
- A dialog box appears in the user's browser, displaying all prompts from the SSH server
- Each prompt is rendered as a text field (visible) or password field (hidden) based on the `echo` flag
- The dialog includes the authentication name and instructions if provided by the server
- The user can input responses for each prompt
- Responses are sent back to the SSH server to continue the authentication process
- This loop continues until authentication succeeds or fails

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
With default settings, if the SSH server uses Keyboard Interactive for password authentication (e.g., PAM with password-only), WebSSH2 will automatically handle it without additional user interaction.

### 2. Two-Factor Authentication (2FA)
For SSH servers requiring password + verification code:
- **Round 1**: Server sends "Password:" prompt → WebSSH2 auto-responds with stored password
- **Round 2**: Server sends "Verification code:" prompt → WebSSH2 forwards to client
- User enters their 2FA code in the browser dialog
- Authentication completes

### 3. Multi-Prompt Authentication
For SSH servers sending multiple prompts in one round (e.g., "Password:" and "PIN:"):
- If ANY prompt doesn't contain "password", all prompts are forwarded to the client
- User fills in all fields in a single dialog
- This ensures users can provide different values for different prompts

### 4. Always Prompt User
By setting `alwaysSendKeyboardInteractivePrompts` to `true`, you can ensure that users always see and respond to all authentication prompts. This is useful for:
- Security-sensitive environments
- Debugging authentication flows
- Ensuring explicit user consent for each authentication step

### 5. Per-Session Control
Clients can set `forwardAllKeyboardInteractivePrompts: true` in their authentication request to:
- Override the default auto-password behavior for specific connections
- Implement custom authentication UI flows
- Debug authentication issues without changing server config

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