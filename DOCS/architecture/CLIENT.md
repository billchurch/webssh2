# Client-Side Module Architecture

[← Back to Architecture](../architecture/) | [← Back to Documentation](../)

## Overview

WebSSH2 uses a companion module called `webssh2_client` which provides the browser-side terminal interface and WebSocket communication layer.

## About webssh2_client

- **Repository**: [https://github.com/billchurch/webssh2_client](https://github.com/billchurch/webssh2_client)
- **Purpose**: Provides the browser-based terminal emulator and WebSocket client
- **Integration**: Automatically included as a dependency in package.json
- **Version**: The compatible version is managed through the package.json dependency
- **Technology**: SolidJS 1.9.9, xterm.js 5.5.0, Vite 5.0.0

## Features

The client module provides:

- **Terminal emulation** using xterm.js
- **WebSocket communication** with the WebSSH2 server
- **User interface** for SSH connections
- **Terminal configuration** and customization
- **Session management**
- **File transfer** capabilities
- **Responsive design** for mobile and desktop
- **Keyboard shortcuts** and accessibility features

## Client-Server Communication

The server integrates with the client module by:

1. **Serving static files** from `/client/public`
2. **Injecting configuration** into the client via `window.webssh2Config`
3. **Managing WebSocket connections** for terminal I/O
4. **Handling authentication** and session management

### Configuration Injection

The server passes configuration to the client through a global object:

```javascript
window.webssh2Config = {
  socket: {
    path: '/ssh/socket.io'
  },
  ssh: {
    host: 'example.com',
    port: 22,
    username: 'user'
  },
  header: {
    text: 'WebSSH2',
    background: 'green'
  }
}
```

### WebSocket Protocol

The client and server communicate using Socket.IO events:

#### Client → Server Events

| Event | Description | Payload |
|-------|-------------|---------|
| `auth` | Authentication request | `{ username, password, ... }` |
| `resize` | Terminal resize | `{ cols, rows }` |
| `data` | Terminal input | `string` |
| `exec` | Execute command | `{ command, pty, ... }` |
| `disconnect` | Client disconnect | - |

#### Server → Client Events

| Event | Description | Payload |
|-------|-------------|---------|
| `data` | Terminal output | `string \| ArrayBuffer` (binary for shell, string for exec) |
| `connect` | Connection established | - |
| `disconnect` | Connection lost | `{ reason }` |
| `error` | Error message | `{ message, type }` |
| `exec-data` | Exec output | `{ type, data }` |
| `exec-exit` | Exec completion | `{ code, signal }` |

## Architecture Components

### 1. Terminal Manager

Handles xterm.js instance and terminal rendering:

```javascript
// Terminal initialization
const term = new Terminal({
  cursorBlink: true,
  scrollback: 10000,
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  theme: {
    foreground: '#ffffff',
    background: '#000000'
  }
});
```

### 2. WebSocket Manager

Manages Socket.IO connection and message handling:

```javascript
// Socket connection
const socket = io({
  path: config.socket.path,
  transports: ['websocket', 'polling']
});

// Event handling — shell data arrives as binary (ArrayBuffer),
// exec data arrives as string. xterm.js accepts both Uint8Array and string.
socket.on('data', (data) => {
  if (data instanceof ArrayBuffer) {
    term.write(new Uint8Array(data));
  } else {
    term.write(data);
  }
});

term.onData((data) => {
  socket.emit('data', data);
});
```

### 3. UI Components

Built with SolidJS for reactive updates:

- **Login Form**: Credential input and validation
- **Terminal Container**: Houses xterm.js instance
- **Menu Bar**: Settings and actions
- **Status Bar**: Connection and session info

### 4. State Management

Client state is managed using SolidJS stores:

```javascript
const [state, setState] = createStore({
  connected: false,
  authenticated: false,
  settings: {
    fontSize: 14,
    theme: 'dark'
  }
});
```

## Development

### Building the Client

```bash
cd webssh2_client
npm install
npm run build
```

### Development Mode

```bash
npm run dev
```

This starts a Vite dev server with hot module replacement on port 3000.

### Linking for Development

Use npm link to connect client to server during development:

```bash
# In webssh2_client directory
npm link

# In webssh2 server directory
npm link webssh2_client
```

## Customization

### Theme Customization

Modify the terminal theme in client configuration:

```javascript
{
  theme: {
    foreground: '#f8f8f2',
    background: '#282a36',
    cursor: '#f8f8f2',
    selection: '#44475a',
    black: '#000000',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#6272a4',
    magenta: '#bd93f9',
    cyan: '#8be9fd',
    white: '#bfbfbf'
  }
}
```

### Keyboard Shortcuts

Default keyboard shortcuts:

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Copy (when text selected) |
| `Ctrl+V` | Paste |
| `Ctrl+Shift+C` | Copy |
| `Ctrl+Shift+V` | Paste |
| `Ctrl++` | Increase font size |
| `Ctrl+-` | Decrease font size |
| `Ctrl+0` | Reset font size |

### Custom Addons

The client supports xterm.js addons:

```javascript
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';

const fitAddon = new FitAddon();
const webLinksAddon = new WebLinksAddon();
const searchAddon = new SearchAddon();

term.loadAddon(fitAddon);
term.loadAddon(webLinksAddon);
term.loadAddon(searchAddon);
```

## Performance Optimization

### Terminal Rendering

- **GPU acceleration** enabled by default
- **Webgl renderer** for improved performance
- **Lazy loading** of terminal content
- **Virtual scrolling** for large outputs

### WebSocket Optimization

- **Binary frames** for shell data — the server emits raw `Buffer` objects for shell output, which Socket.IO sends as binary WebSocket frames. This bypasses UTF-8 string conversion and JSON serialization on the server, and the client passes the resulting `Uint8Array` directly to xterm.js without decoding. String decoding is deferred to the session logger only when logging is active.
- **Compression** enabled when supported
- **Reconnection logic** with exponential backoff
- **Connection pooling** for multiple sessions

## Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 88+ | Full support |
| Firefox | 85+ | Full support |
| Safari | 14+ | Full support |
| Edge | 88+ | Full support |
| Opera | 74+ | Full support |

## Mobile Support

The client includes responsive design for mobile devices:

- **Touch keyboard** support
- **Gesture handling** for scrolling
- **Viewport optimization**
- **Mobile-friendly UI**

## Accessibility

Built-in accessibility features:

- **Screen reader** support
- **Keyboard navigation**
- **High contrast** themes
- **Focus indicators**
- **ARIA labels**

## Related Documentation

- [Development Setup](../development/SETUP.md)
- [WebSocket API](../api/WEBSOCKET-API.md)
- [Configuration](../configuration/OVERVIEW.md)
- [Testing](../development/TESTING.md)