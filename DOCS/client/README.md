# WebSSH2 Client Documentation

This directory contains documentation specific to the WebSSH2 web client (browser-side application).

## Client Features

### Keyboard Capture

Control which keyboard events are sent to the terminal versus handled by the web UI.

- **[Keyboard Capture Summary](./KEYBOARD_CAPTURE_SUMMARY.md)** - Quick reference guide
- **[Keyboard Capture Full Documentation](./KEYBOARD_CAPTURE.md)** - Comprehensive documentation

**Key Features**:
- Capture Escape key for tmux/vim users
- Capture Ctrl+B for tmux users
- Custom capture keys for power users
- Configurable through Terminal Settings UI
- Settings persist in browser localStorage

**Use Cases**:
- Fix tmux Escape key focus loss ([Issue #455](https://github.com/billchurch/webssh2/issues/455))
- Enable tmux prefix key (Ctrl+B)
- Custom terminal application shortcuts
- Prevent browser shortcuts from interfering with terminal workflows

## Related Documentation

### Server-Side

- [Authentication Methods](../features/AUTHENTICATION.md)
- [Private Key Authentication](../features/PRIVATE-KEYS.md)
- [Keyboard-Interactive Auth](../features/KEYBOARD-INTERACTIVE.md)

### Client Features

- [Client Features Overview](../features/CLIENT-FEATURES.md)
- [URL Parameters](../configuration/URL-PARAMETERS.md)

### Configuration

- [Configuration Overview](../configuration/OVERVIEW.md)
- [Environment Variables](../configuration/ENVIRONMENT-VARIABLES.md)

## Client Architecture

The WebSSH2 client is built with:

- **Framework**: SolidJS (reactive UI framework)
- **Terminal**: xterm.js 5.5
- **Communication**: Socket.IO 4.8 (WebSocket)
- **Build Tool**: Vite 5.0
- **Language**: TypeScript (strict mode)

### Key Components

```
webssh2_client/client/src/
├── app.tsx                          # Main application
├── components/                      # UI components
│   ├── Terminal.tsx                 # Terminal component
│   ├── LoginModal.tsx              # Login dialog
│   ├── TerminalSettingsModal.tsx   # Settings UI
│   ├── TerminalSearch.tsx          # Search overlay
│   └── Modal.tsx                   # Base modal
├── utils/
│   ├── keyboard-capture.ts         # Keyboard capture logic
│   └── settings.ts                 # LocalStorage persistence
├── stores/                         # State management
└── services/                       # Business logic
```

## Development

For client development information, see the webssh2_client repository:

- [Client Development Guide](https://github.com/billchurch/webssh2_client/blob/main/DOCS/develop/DEVELOPMENT.md)
- [Client Features](https://github.com/billchurch/webssh2_client/blob/main/DOCS/FEATURES.md)

## Version Information

The keyboard capture feature was added in:

- **WebSSH2 Server**: v2.5.0
- **WebSSH2 Client**: v2.2.0

Check the [CHANGELOG](../reference/CHANGELOG.md) for version-specific information.
