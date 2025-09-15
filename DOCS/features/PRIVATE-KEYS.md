# SSH Private Key Authentication

[← Back to Features](../features/) | [← Back to Documentation](../)

## Overview

WebSSH2 supports SSH private key authentication when using the `/ssh/host/` endpoint with a private key configured in the server settings or via the interactive method with the `/ssh/` endpoint.

## Endpoint Support

- **`/ssh/host/:host`** - Supports private key authentication configured via `config.json`
- **`/ssh`** - Supports private key authentication via interactive web interface (users can provide keys directly)

## Configuration

Private key authentication can be configured through the `config.json` file for use with the `/ssh/host/` endpoints:

### Via config.json

```json
{
  "user": {
    "name": "myuser",
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nYour-Private-Key-Here\n-----END RSA PRIVATE KEY-----",
    "passphrase": "passphrase-for-encrypted-key",
    "password": "optional-fallback-password"
  }
}
```

### Via Environment Variables

```bash
WEBSSH2_USER_NAME=myuser
WEBSSH2_USER_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
WEBSSH2_USER_PASSPHRASE="your-passphrase"
WEBSSH2_USER_PASSWORD="fallback-password"
```

**Note:** The `/ssh` endpoint also supports private key authentication through the interactive web interface, where users can paste or upload their private keys directly.

## Key Requirements

- Only `ssh-rsa` type keys are supported
- Passphrase encryption is supported, and if used the `passphrase` must be provided
- The private key must be in PEM format
- The key in `config.json` must be on a single line with `\n` as line separators
- Must include the appropriate header and footer:

### Standard Key Format
```bash
-----BEGIN RSA PRIVATE KEY-----\n[... key content ...]\n-----END RSA PRIVATE KEY-----
```

### Encrypted Key Format
```bash
-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,5930F19760F7FBBC865400940A89D954\n\n[... key content ...]\n-----END RSA PRIVATE KEY-----
```

## Generating a Private Key

To generate a new SSH private key, you can use the following command:

```bash
ssh-keygen -m PEM -t rsa -b 4096 -f ~/.ssh/id_rsa
```

## Converting Your Private Key

Keys uploaded or pasted using the interactive mode through the `/ssh` endpoint can work as-is, however if using a key with `config.json` you must convert your existing SSH private key into the correct format (single line). 

### Conversion Script

A bash one-liner to accomplish this:

```bash
echo '    "privateKey": "'$(cat ~/.ssh/id_rsa | tr '\n' '~' | sed 's/~/\\n/g')'"'
```

This command:
1. Reads your private key file
2. Converts newlines to temporary characters
3. Replaces those characters with `\n`
4. Wraps the result in quotes
5. Outputs the key in a format ready to paste into your `config.json`

## Authentication Process

1. When connecting through the `/ssh/host/` endpoint, WebSSH2 will first attempt to authenticate using the private key specified in `config.json`
2. If key authentication fails and `user.password` is configured, the system will automatically attempt password authentication
3. If both authentication methods fail, you'll receive an authentication error

## Security Considerations

- Store private keys securely in your server configuration
- Use appropriate file permissions for your `config.json` file (e.g., `chmod 600`)
- Consider using encrypted private keys for additional security
- Always use HTTPS when accessing the WebSSH2 service
- Never commit private keys to version control

## Example Usage

### Step 1: Convert and Configure Your Private Key

```bash
# First, convert your key
echo '"'$(cat ~/.ssh/id_rsa | tr '\n' '~' | sed 's/~/\\n/g')'"'

# Copy the output and paste it into config.json
```

### Step 2: Configure config.json

```json
{
  "user": {
    "name": "myuser",
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpA...[rest of key]...Yh5Q==\n-----END RSA PRIVATE KEY-----",
    "passphrase": "your-passphrase-here",
    "password": "fallback-password"
  }
}
```

### Step 3: Access the Service

```
https://your-server:2222/ssh/host/target-server
```

## Troubleshooting

If key authentication fails, check:

- Key type is `ssh-rsa`
- Key format in `config.json` is properly escaped with `\n` line separators
- Key permissions on the target SSH server
- Server's `authorized_keys` file configuration
- SSH server logs for specific authentication failure reasons

### Common Issues

1. **"Permission denied (publickey)"**
   - Verify the public key is in the target server's `~/.ssh/authorized_keys`
   - Check file permissions: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`

2. **"invalid privatekey"**
   - Ensure the key is in PEM format (not OpenSSH format)
   - Verify proper line separator conversion (`\n`)

3. **"Encrypted private key detected, but no passphrase given"**
   - Add the `passphrase` field to your configuration

## Related Documentation

- [Authentication Overview](./AUTHENTICATION.md)
- [Keyboard Interactive Authentication](./KEYBOARD-INTERACTIVE.md)
- [Configuration Guide](../configuration/CONFIG-JSON.md)