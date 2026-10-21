# Exec Channel - Non-Interactive Command Execution

[← Back to Features](../features/) | [← Back to Documentation](../)

## Overview

WebSSH2 supports non-interactive command execution over SSH using the SSH2 exec channel, in addition to the interactive shell.

- When clients emit an `exec` request, the server runs the command on the existing SSH connection and sends the output back to the client
- This feature is additive and does not change the existing interactive shell flow
- The SSH connection remains open after command completion so multiple execs can reuse a single session

## WebSocket API

### Client → Server: `exec`

**Event:** `exec`

**Payload:**

```javascript
{
  command: string // Required: non-empty command, at most 65536 characters
}
```

Any other fields in the payload are ignored. The server does not allocate a
PTY, forward per-request environment variables, or apply a per-request timeout
for exec.

### Server → Client: `data`

When the command finishes, the server emits its stdout on the `data` event,
followed by its stderr (only when non-empty). Output is buffered on the server
and capped by `ssh.maxExecOutputBytes`.

### Server → Client: `ssherror`

Sent when the payload is invalid (for example a missing or non-string
`command`), when no SSH connection exists yet, or when the command cannot be
run. Invalid payloads never reach the SSH connection.

## Security Notes

- Exec requests respect the same SSH authentication and authorization as shells
- Exec is available on the SSH namespace only, not on telnet
- Environment variables from the `env` query parameter (`env=FOO:bar,BAZ:qux`) are accepted only on a request that carries credentials (Basic Auth `/ssh/host/...` or a POST login). They apply to the interactive shell, not to exec
- All exec commands are subject to the same security policies as interactive sessions

## Example Usage

```javascript
// Client → Server
socket.emit('exec', { command: 'ls -la /var/log' })

// Server → Client
socket.on('data', (chunk) => {
  console.log('Output:', chunk)
})

socket.on('ssherror', (message) => {
  console.error('Exec failed:', message)
})
```

## Use Cases

### System Monitoring

Execute monitoring commands without opening a full shell:

```javascript
socket.emit('exec', { command: 'df -h' })
socket.emit('exec', { command: 'free -m' })
socket.emit('exec', { command: 'top -bn1' })
```

### File Operations

```javascript
socket.emit('exec', { command: 'ls -la /etc' })
socket.emit('exec', { command: 'tail -n 50 /var/log/syslog' })
```

For interactive or full-screen programs, use the interactive shell instead.

## Related Documentation

- [WebSocket API Reference](../api/WEBSOCKET-API.md)
- [Authentication](./AUTHENTICATION.md)
- [Environment Forwarding](./ENVIRONMENT-FORWARDING.md)
