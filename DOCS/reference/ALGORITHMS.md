# Supported SSH Algorithms

This document lists all SSH algorithms supported by WebSSH2's underlying SSH2 library. Algorithm availability depends on Node.js version and OpenSSL configuration.

> **Node.js Requirement**: WebSSH2 requires Node.js >= 22

## Quick Reference

| Category | Recommended | Legacy/Weak |
|----------|-------------|-------------|
| Cipher | `aes256-gcm@openssh.com`, `chacha20-poly1305@openssh.com` | `3des-cbc`, `aes*-cbc` |
| HMAC | `hmac-sha2-256-etm@openssh.com`, `hmac-sha2-512-etm@openssh.com` | `hmac-md5`, `hmac-sha1` |
| KEX | `curve25519-sha256`, `ecdh-sha2-nistp256` | `diffie-hellman-group1-sha1` |
| Host Key | `ssh-ed25519`, `rsa-sha2-512` | `ssh-dss`, `ssh-rsa` |

## Ciphers

Encryption algorithms for the SSH transport layer.

### Supported Ciphers

| Cipher | Mode | Notes |
|--------|------|-------|
| `aes128-gcm@openssh.com` | AEAD | Recommended - authenticated encryption |
| `aes256-gcm@openssh.com` | AEAD | Recommended - authenticated encryption |
| `chacha20-poly1305@openssh.com` | AEAD | Recommended - fast on systems without AES-NI |
| `aes128-ctr` | CTR | Good - standard counter mode |
| `aes192-ctr` | CTR | Good - standard counter mode |
| `aes256-ctr` | CTR | Good - standard counter mode |
| `aes128-gcm` | AEAD | Alternative GCM naming |
| `aes256-gcm` | AEAD | Alternative GCM naming |
| `aes128-cbc` | CBC | Legacy - vulnerable to padding oracle attacks |
| `aes192-cbc` | CBC | Legacy - vulnerable to padding oracle attacks |
| `aes256-cbc` | CBC | Legacy - vulnerable to padding oracle attacks |
| `3des-cbc` | CBC | Legacy - slow, 112-bit effective security |

### Cipher Selection Priority

The SSH2 library automatically prioritizes ciphers based on:
1. **CPU capabilities** - AES-NI acceleration detection
2. **Security** - AEAD modes preferred over CBC
3. **Performance** - ChaCha20 moved up on non-AES-NI systems

## HMACs (Message Authentication Codes)

Integrity verification algorithms.

### Supported HMACs

| HMAC | Security | Notes |
|------|----------|-------|
| `hmac-sha2-256-etm@openssh.com` | Strong | Recommended - Encrypt-then-MAC |
| `hmac-sha2-512-etm@openssh.com` | Strong | Recommended - Encrypt-then-MAC |
| `hmac-sha1-etm@openssh.com` | Moderate | Encrypt-then-MAC variant |
| `hmac-sha2-256` | Strong | Standard HMAC |
| `hmac-sha2-512` | Strong | Standard HMAC |
| `hmac-sha1` | Moderate | Legacy - still widely used |
| `hmac-sha2-256-96` | Strong | Truncated to 96 bits |
| `hmac-sha2-512-96` | Strong | Truncated to 96 bits |
| `hmac-sha1-96` | Moderate | Truncated to 96 bits |
| `hmac-ripemd160` | Moderate | Less common |
| `hmac-md5` | Weak | Legacy only - MD5 is broken |
| `hmac-md5-96` | Weak | Legacy only - MD5 is broken |

### ETM vs Standard MACs

**Encrypt-then-MAC (ETM)** variants (`*-etm@openssh.com`) are preferred because they:
- Authenticate the ciphertext, not plaintext
- Prevent padding oracle attacks
- Are the modern standard for SSH

## Key Exchange (KEX) Algorithms

Algorithms for establishing shared secrets.

### Supported KEX Algorithms

| KEX Algorithm | Security | Notes |
|---------------|----------|-------|
| `curve25519-sha256@libssh.org` | Strong | Recommended - fast, secure |
| `curve25519-sha256` | Strong | Recommended - RFC 8731 |
| `ecdh-sha2-nistp256` | Strong | NIST P-256 curve |
| `ecdh-sha2-nistp384` | Strong | NIST P-384 curve |
| `ecdh-sha2-nistp521` | Strong | NIST P-521 curve |
| `diffie-hellman-group-exchange-sha256` | Strong | Custom DH parameters |
| `diffie-hellman-group14-sha256` | Strong | 2048-bit MODP |
| `diffie-hellman-group15-sha512` | Strong | 3072-bit MODP |
| `diffie-hellman-group16-sha512` | Strong | 4096-bit MODP |
| `diffie-hellman-group17-sha512` | Strong | 6144-bit MODP |
| `diffie-hellman-group18-sha512` | Strong | 8192-bit MODP |
| `diffie-hellman-group-exchange-sha1` | Moderate | Legacy - SHA1 |
| `diffie-hellman-group14-sha1` | Moderate | Legacy - SHA1, required by RFC |
| `diffie-hellman-group1-sha1` | Weak | Legacy only - 1024-bit, vulnerable |

## Server Host Key Algorithms

Algorithms for server authentication.

### Supported Host Key Algorithms

| Algorithm | Security | Notes |
|-----------|----------|-------|
| `ssh-ed25519` | Strong | Recommended - EdDSA, fast |
| `ecdsa-sha2-nistp256` | Strong | NIST P-256 ECDSA |
| `ecdsa-sha2-nistp384` | Strong | NIST P-384 ECDSA |
| `ecdsa-sha2-nistp521` | Strong | NIST P-521 ECDSA |
| `rsa-sha2-512` | Strong | RSA with SHA-512 (RFC 8332) |
| `rsa-sha2-256` | Strong | RSA with SHA-256 (RFC 8332) |
| `ssh-rsa` | Moderate | Legacy - SHA1 signatures |
| `ssh-dss` | Weak | Legacy only - DSA is deprecated |

## Compression Algorithms

### Supported Compression

| Algorithm | Notes |
|-----------|-------|
| `none` | No compression (default) |
| `zlib@openssh.com` | Compression after authentication |
| `zlib` | Compression from start |

## FIPS Mode Considerations

When Node.js is running in FIPS (Federal Information Processing Standards) mode, many algorithms are restricted or unavailable.

### FIPS-Approved Algorithms

In FIPS mode, only these algorithms are typically available:

**Ciphers:**
- `aes128-ctr`, `aes192-ctr`, `aes256-ctr`
- `aes128-gcm@openssh.com`, `aes256-gcm@openssh.com`

**HMACs:**
- `hmac-sha2-256`, `hmac-sha2-512`
- `hmac-sha2-256-etm@openssh.com`, `hmac-sha2-512-etm@openssh.com`
- `hmac-sha1` (for legacy compatibility only)

**KEX:**
- `ecdh-sha2-nistp256`, `ecdh-sha2-nistp384`, `ecdh-sha2-nistp521`
- `diffie-hellman-group14-sha256`, `diffie-hellman-group16-sha512`

**Host Keys:**
- `ecdsa-sha2-nistp256`, `ecdsa-sha2-nistp384`, `ecdsa-sha2-nistp521`
- `rsa-sha2-256`, `rsa-sha2-512`

### Algorithms NOT Available in FIPS Mode

- `chacha20-poly1305@openssh.com` - ChaCha20 not FIPS-approved
- `curve25519-sha256*` - Curve25519 not FIPS-approved
- `hmac-md5*` - MD5 not FIPS-approved
- `ssh-ed25519` - Ed25519 not FIPS-approved
- `*-sha1` KEX algorithms - SHA1 deprecated for signatures
- `3des-cbc` - Triple DES deprecated in FIPS 140-3
- `ssh-dss` - DSA not FIPS-approved for new applications

### Enabling FIPS Mode

```bash
# Check if Node.js has FIPS support
node -p "crypto.getFips()"

# Enable FIPS mode (requires OpenSSL FIPS provider)
node --enable-fips your-app.js

# Or via environment variable
NODE_OPTIONS=--enable-fips npm start
```

### FIPS Configuration Example

```bash
# FIPS-compliant configuration
WEBSSH2_SSH_ALGORITHMS_CIPHER="aes256-gcm@openssh.com,aes256-ctr"
WEBSSH2_SSH_ALGORITHMS_KEX="ecdh-sha2-nistp384,diffie-hellman-group16-sha512"
WEBSSH2_SSH_ALGORITHMS_HMAC="hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com"
WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY="ecdsa-sha2-nistp384,rsa-sha2-512"
```

## Algorithm Presets

WebSSH2 provides built-in presets for common use cases:

### `modern` (Recommended)

Balanced security and compatibility for contemporary systems.

```
Ciphers: aes256-gcm@openssh.com, aes128-gcm@openssh.com, aes256-ctr, aes128-ctr
KEX: ecdh-sha2-nistp256, ecdh-sha2-nistp384, ecdh-sha2-nistp521
HMAC: hmac-sha2-256, hmac-sha2-512
Host Keys: ecdsa-sha2-nistp256, ecdsa-sha2-nistp384, ecdsa-sha2-nistp521, ssh-rsa
```

### `legacy`

For connecting to older SSH servers.

```
Ciphers: aes256-cbc, aes192-cbc, aes128-cbc, 3des-cbc
KEX: diffie-hellman-group14-sha1, diffie-hellman-group1-sha1
HMAC: hmac-sha1, hmac-md5
Host Keys: ssh-rsa, ssh-dss
```

### `strict`

Maximum security, minimal compatibility.

```
Ciphers: aes256-gcm@openssh.com
KEX: ecdh-sha2-nistp256
HMAC: hmac-sha2-256
Host Keys: ecdsa-sha2-nistp256
```

## Checking Available Algorithms

To see which algorithms are available on your system:

```bash
node -e "
const constants = require('ssh2/lib/protocol/constants.js');
console.log('Ciphers:', constants.SUPPORTED_CIPHER.join(', '));
console.log('HMACs:', constants.SUPPORTED_MAC.join(', '));
console.log('KEX:', constants.SUPPORTED_KEX.join(', '));
console.log('Host Keys:', constants.SUPPORTED_SERVER_HOST_KEY.join(', '));
"
```

## Troubleshooting

### "No matching cipher" Error

The server doesn't support any of your configured ciphers. Solutions:
1. Use the `legacy` preset: `WEBSSH2_SSH_ALGORITHMS_PRESET=legacy`
2. Add specific legacy ciphers: `WEBSSH2_SSH_ALGORITHMS_CIPHER="aes256-cbc,aes128-cbc"`

### "No matching MAC" Error

Similar to cipher errors. Add legacy HMACs:
```bash
WEBSSH2_SSH_ALGORITHMS_PRESET=modern
WEBSSH2_SSH_ALGORITHMS_HMAC="hmac-sha1,hmac-sha2-256,hmac-sha2-512"
```

### FIPS Mode Failures

If connections fail in FIPS mode:
1. Verify FIPS is properly enabled: `node -p "crypto.getFips()"`
2. Use only FIPS-approved algorithms (see above)
3. Check server supports FIPS-compliant algorithms

### Debugging Algorithm Negotiation

Enable debug logging to see algorithm negotiation:
```bash
DEBUG=webssh2:* npm start
```

## See Also

- [Environment Variables](../configuration/ENVIRONMENT-VARIABLES.md#ssh-algorithms) - Algorithm configuration
- [SSH2 Library](https://github.com/mscdex/ssh2) - Underlying SSH implementation
- [RFC 4253](https://tools.ietf.org/html/rfc4253) - SSH Transport Layer Protocol
- [NIST SP 800-131A](https://csrc.nist.gov/publications/detail/sp/800-131a/rev-2/final) - Cryptographic algorithm guidance
