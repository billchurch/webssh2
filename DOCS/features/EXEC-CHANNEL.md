# Exec Channel - Non-Interactive Command Execution

[← Back to Features](../features/) | [← Back to Documentation](../)

## Overview

WebSSH2 supports non-interactive command execution over SSH using the SSH2 exec channel, in addition to the interactive shell.

- When clients emit an `exec` request, the server executes the provided command and streams output back to the client
- This feature is additive and does not change the existing interactive shell flow
- The SSH connection remains open after command completion so multiple execs can reuse a single session

## WebSocket API

### Client → Server: `exec`

**Event:** `exec`

**Payload:**
```javascript
{
  command: string,      // Required: command to execute
  pty: boolean,        // Optional: request a PTY for the exec channel
  term: string,        // Optional: terminal type (defaults to session value)
  cols: number,        // Optional: terminal columns (defaults to session value)
  rows: number,        // Optional: terminal rows (defaults to session value)
  env: object,         // Optional: environment variables to merge with session env
  timeoutMs: number    // Optional: kill/terminate exec if exceeded
}
```

### Server → Client: `exec-data`

**Event:** `exec-data`

**Payload:**
```javascript
{
  type: 'stdout' | 'stderr',
  data: string
}
```

### Server → Client: `exec-exit`

**Event:** `exec-exit`

**Payload:**
```javascript
{
  code: number | null,
  signal: string | null
}
```

## Compatibility and Behavior

- **Stdout** is sent on both the existing `data` event and `exec-data` with `type: 'stdout'` for backward compatibility with terminal sinks
- **Stderr** is sent only via `exec-data` with `type: 'stderr'` to avoid polluting legacy terminal output handlers
- The SSH connection remains open after command completion so multiple execs can reuse a single session

## Security Notes

- Exec requests respect the same SSH authentication and authorization as shells
- You can provide environment variables via query (`env=FOO:bar,BAZ:qux`) which are applied to both shell and exec sessions
- All exec commands are subject to the same security policies as interactive sessions

## Example Usage

### Basic Example

```javascript
// Client → Server
socket.emit('exec', {
  command: 'ls -la /var/log'
})

// Server → Client
socket.on('exec-data', ({ type, data }) => {
  if (type === 'stdout') {
    console.log('Output:', data)
  } else {
    console.error('Error:', data)
  }
})

socket.on('exec-exit', ({ code, signal }) => {
  console.log('Command exited with code:', code)
})
```

### Interactive Application Example

```javascript
// Client → Server - Running an interactive application
socket.emit('exec', {
  command: 'htop',
  pty: true,
  term: 'xterm-256color',
  cols: 120,
  rows: 40,
  env: { FOO: 'bar' },
  timeoutMs: 30000
})

// Server → Client
socket.on('exec-data', ({ type, data }) => {
  if (type === 'stdout') process.stdout.write(data)
  else process.stderr.write(data)
})

socket.on('exec-exit', ({ code, signal }) => {
  console.log('exit:', code, signal)
})
```

## Troubleshooting

### PTY for TUIs
Interactive full-screen apps (e.g., `mc`, `htop`, `sudo`) typically require a TTY. Clients should set `pty: true` in the `exec` payload, and forward stdin and terminal resize events while the command runs.

### Mouse Inputs Print Escapes
This happens when the client does not forward raw stdin to the server or no PTY is allocated. Ensure the client requests `pty: true` and forwards `data` (stdin) and `resize` events during exec. The official CLI forwards both when `--pty` is used.

### TERM/terminfo Mismatches
If keys or line-drawing characters look wrong, try a simpler terminal type (`term: "xterm"`), or ensure the remote host has a terminfo entry for your TERM (`infocmp $TERM`).

### Dimensions and Resizing
Exec PTY sizing uses `cols/rows` from the session (or the exec payload). Clients should emit `resize` during exec so the server calls `setWindow` on the exec stream.

### No Live Output
Non-PTY exec may buffer output until completion. Use `pty: true` for interactive, incremental output.

### Timeout Behavior
If the client sets `timeoutMs`, the server attempts to signal/close the exec stream and emits `exec-exit` with `{ code: null, signal: 'TIMEOUT' }`.

### Exit Codes
The server emits `exec-exit` with the remote exit `code` (and `signal` when applicable). Clients can map this directly to their process exit status.

## Advanced Configuration

### Environment Variables

You can pass environment variables to exec commands in two ways:

1. **Via exec payload:**
   ```javascript
   socket.emit('exec', {
     command: 'echo $MY_VAR',
     env: { MY_VAR: 'Hello World' }
   })
   ```

2. **Via URL query parameters:**
   ```
   http://localhost:2222/ssh?env=MY_VAR:value,OTHER_VAR:value2
   ```

### Terminal Settings

For interactive applications requiring specific terminal capabilities:

```javascript
socket.emit('exec', {
  command: 'vim myfile.txt',
  pty: true,
  term: 'xterm-256color',  // Full color support
  cols: 120,
  rows: 40
})
```

## Use Cases

### 1. System Monitoring
Execute monitoring commands without opening a full shell:
```javascript
socket.emit('exec', { command: 'df -h' })
socket.emit('exec', { command: 'free -m' })
socket.emit('exec', { command: 'top -bn1' })
```

### 2. File Operations
Perform file operations programmatically:
```javascript
socket.emit('exec', { command: 'ls -la /etc' })
socket.emit('exec', { command: 'cat /etc/hosts' })
socket.emit('exec', { command: 'tail -n 50 /var/log/syslog' })
```

### 3. Automated Deployment
Run deployment scripts:
```javascript
socket.emit('exec', {
  command: '/opt/deploy/deploy.sh',
  timeoutMs: 300000  // 5 minute timeout
})
```

### 4. Interactive Applications
Run full-screen applications:
```javascript
socket.emit('exec', {
  command: 'mc',  // Midnight Commander
  pty: true,
  term: 'xterm-256color'
})
```

## Related Documentation

- [WebSocket API Reference](../api/WEBSOCKET-API.md)
- [Authentication](./AUTHENTICATION.md)
- [Environment Forwarding](./ENVIRONMENT-FORWARDING.md)