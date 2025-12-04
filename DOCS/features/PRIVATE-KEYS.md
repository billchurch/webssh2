# SSH Private Key Authentication

[← Back to Features](../features/) | [← Back to Documentation](../)

## Overview

WebSSH2 supports SSH private key authentication when using the `/ssh/host/` endpoint with a private key configured in the server settings or via the interactive method with the `/ssh/` endpoint.

## Endpoint Support

- **`/ssh/host/:host`** - Supports private key authentication configured via `config.json`
- **`/ssh`** - Supports private key authentication via interactive web interface (users can provide keys directly through browser)

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

## Browser-Based Private Key Authentication

### Overview

When using the `/ssh` endpoint, WebSSH2 provides an interactive web interface that allows users to authenticate using their SSH private keys directly from the browser. This provides flexibility for users who need to connect to different hosts without server-side key configuration.

### How It Works

1. **Access the Login Interface**: Navigate to `/ssh` in your browser
2. **Enter Connection Details**: Provide hostname, port, and username
3. **Add SSH Key**: Click the "Add SSH Key" button to expand the private key section
4. **Provide Your Key**: Either:
   - **Paste** your private key directly into the text area, or
   - **Upload** your private key file using the file picker
5. **Enter Passphrase** (if needed): If your private key is encrypted, enter the passphrase in the provided field
6. **Connect**: Click "Connect" to establish the SSH session

### Supported Key Formats

The browser client supports and automatically detects the following private key formats:

- **OpenSSH** format (modern default from `ssh-keygen`)
- **PKCS#8** format
- **PKCS#1 RSA** format (traditional `-----BEGIN RSA PRIVATE KEY-----`)
- **EC** (Elliptic Curve) keys
- **DSA** keys

The client performs real-time validation and displays:

- ✓ Green indicator for valid keys with format detection
- ✗ Red indicator for invalid keys with helpful error messages
- Suggestions for common mistakes (e.g., attempting to use a public key)

### Security Warnings

> **CRITICAL: Private Key Transmission**
>
> When using browser-based private key authentication, your **entire private key is transmitted from your browser to the WebSSH2 server** over the WebSocket connection. The server then uses this key to authenticate with the target SSH host.

#### Required Security Measures

1. **HTTPS is MANDATORY**: Always access WebSSH2 over HTTPS (not HTTP)
   - Use TLS 1.3 for optimal security (minimum TLS 1.2)
   - Verify the SSL certificate is valid and trusted
   - Never use browser-based key authentication over unencrypted HTTP

2. **Trust Your WebSSH2 Server**: Only use browser-based private key authentication with WebSSH2 servers you fully trust
   - The server receives your unencrypted private key
   - Malicious or compromised servers could retain your private key
   - Consider using server-configured keys (`/ssh/host/`) for production environments

3. **Network Security**: Ensure the network path between your browser and the WebSSH2 server is secure
   - Avoid using browser-based key authentication on untrusted networks (public WiFi, etc.)
   - Use a VPN when connecting over untrusted networks
   - Monitor for TLS downgrade attacks

4. **Use Encrypted Keys**: When possible, use passphrase-protected private keys
   - Adds an additional layer of security
   - Protects your key if the file is compromised locally

#### Best Practices

- **Temporary Sessions**: Consider browser-based authentication best suited for temporary or interactive sessions
- **Dedicated Keys**: Use dedicated SSH keys for WebSSH2 access rather than your primary keys
- **Key Rotation**: Regularly rotate keys used for browser-based authentication
- **Audit Logs**: Enable and monitor server-side authentication logs
- **Alternative Methods**: For automated or production use, prefer:
  - Server-configured keys via `config.json` (for `/ssh/host/` endpoints)
  - Password authentication (when acceptable)
  - Keyboard-interactive authentication

### Advantages

- **No Server Configuration**: Users can connect without administrator intervention
- **Flexibility**: Different keys for different target hosts
- **User Control**: Users maintain control over which keys are used
- **Multiple Key Support**: Easy switching between different keys for different connections

### Limitations

- **Private Key Transmission**: Full key is transmitted to WebSSH2 server (see security warnings above)
- **Browser Storage**: Keys are not persisted (must be provided on each connection)
- **Server Trust Required**: Must fully trust the WebSSH2 server operator

## Key Requirements

### For Server-Configured Keys (`/ssh/host/` endpoint)

- Only `ssh-rsa` type keys are supported
- Passphrase encryption is supported, and if used the `passphrase` must be provided
- The private key must be in PEM format
- The key in `config.json` must be on a single line with `\n` as line separators
- Must include the appropriate header and footer

### For Browser-Based Keys (`/ssh` endpoint)

- Multiple key formats supported: OpenSSH, PKCS#8, PKCS#1 RSA, EC, DSA
- Passphrase encryption is fully supported
- Keys can be in multi-line format (no conversion needed)
- Automatic format detection and validation
- Real-time feedback on key validity

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

```bash
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

## Future Roadmap

The WebSSH2 project is exploring enhanced security features for private key authentication:

### Client-Side Cryptographic Operations

Future versions may implement client-side signing where:

- Private keys remain in the browser and are never transmitted
- Cryptographic signature operations occur entirely on the client side
- Only signatures (not keys) are sent to the WebSSH2 server
- Leverages Web Crypto API for secure key handling
- Reduces trust requirements for the WebSSH2 server

### Hardware Security Key Integration

Planned support for hardware-based authentication includes:

- **YubiKey Support**: Integration with YubiKey PIV (Personal Identity Verification) applets
- **Smart Card/PIV Cards**: Support for standard PIV-compliant smart cards
- **WebAuthn/FIDO2**: Potential integration with modern web authentication standards
- **Hardware-Backed Keys**: Support for platform-specific secure enclaves (TPM, Secure Enclave, etc.)

### Benefits of Future Enhancements

1. **Zero Trust Architecture**: Private keys never leave secure hardware or the browser
2. **Compromised Server Protection**: Even a malicious WebSSH2 server cannot steal your private key
3. **Compliance**: Better alignment with security standards requiring hardware key storage
4. **Audit Trail**: Hardware keys often provide better logging and attestation
5. **Multi-Factor**: Hardware keys can combine "something you have" with "something you know"

### Implementation Challenges

- **SSH Protocol Constraints**: SSH protocol was designed for direct client-server communication
- **WebSocket Proxy Model**: Adapting SSH challenge-response through a proxy layer
- **Browser Limitations**: Web Crypto API and WebAuthn have constraints on supported algorithms
- **Backward Compatibility**: Maintaining support for existing authentication methods
- **User Experience**: Balancing security improvements with ease of use

**Note**: These features are under research and development. Follow the [WebSSH2 GitHub repository](https://github.com/billchurch/webssh2) for updates on implementation progress.

## Related Documentation

- [Authentication Overview](./AUTHENTICATION.md)
- [Keyboard Interactive Authentication](./KEYBOARD-INTERACTIVE.md)
- [Configuration Guide](../configuration/CONFIG-JSON.md)
