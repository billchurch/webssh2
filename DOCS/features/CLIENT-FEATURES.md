# WebSSH2 Client Features

## Terminal Emulation

WebSSH2 provides a full-featured web-based terminal emulator using xterm.js with comprehensive functionality.

### Core Terminal Features

- **xterm.js Integration**: Full terminal emulation with ANSI color support
- **Terminal Type Support**: Configurable terminal type (default: xterm-color)
- **Responsive Design**: Automatically adjusts to window size changes
- **Mouse Support**: Full terminal mouse interaction support
- **Session Logging**: Download terminal session logs for audit/review

## Search Functionality

The terminal includes powerful search capabilities for finding text within the terminal output.

### Search Features

- **Real-time Search**: Live match highlighting as you type
- **Search Options**:
  - Case-sensitive search toggle
  - Regular expression support
  - Whole word matching
- **Match Navigation**:
  - Match counter showing current/total matches
  - Navigate with Enter/Shift+Enter
  - Arrow buttons for match navigation
  - F3/Shift+F3 for quick navigation
- **Keyboard Shortcuts**:
  - Windows/Linux: `Ctrl+F` to open search
  - macOS: `⌘F` to open search

## Clipboard Integration

WebSSH2 includes advanced clipboard features similar to traditional terminal emulators like PuTTY and tmux.

### Auto-copy Feature

- **Automatic Selection Copy**: Text selected with the mouse is automatically copied to the system clipboard
- **Terminal-like Behavior**: Similar to tmux or PuTTY auto-copy functionality
- **Configurable**: Can be enabled/disabled in Terminal Settings
- **Visual Feedback**: Toast notifications confirm copy operations

### Paste Options

- **Middle-click Paste**: Paste clipboard contents with middle mouse button
- **Keyboard Shortcuts**:
  - Windows/Linux: `Ctrl+Shift+V` to paste
  - macOS: `⌘+Shift+V` to paste
- **Right-click Context Menu**: Alternative paste method
- **Configurable**: All paste methods can be enabled/disabled

### Copy Options

- **Selection Copy**: Select text to copy (when auto-copy enabled)
- **Keyboard Shortcuts**:
  - Windows/Linux: `Ctrl+Shift+C` to copy
  - macOS: `⌘+Shift+C` to copy
- **Browser Compatibility**: Automatic detection with fallback mechanisms

### Clipboard Settings

All clipboard features can be configured through:

1. **Terminal Settings Modal**: Access from the menu to toggle features
2. **LocalStorage Configuration**: Programmatic control via JavaScript
3. **Default Settings**:
   - `clipboardAutoSelectToCopy`: true (auto-copy enabled)
   - `clipboardEnableMiddleClickPaste`: true (middle-click enabled)
   - `clipboardEnableKeyboardShortcuts`: true (shortcuts enabled)

### Browser Requirements

- **Secure Context**: HTTPS or localhost required for clipboard API
- **Permissions**: Browser may require clipboard permissions
- **Compatibility**: Modern browser with Clipboard API support
- **Fallback**: Graceful degradation for older browsers

## Terminal Customization

### Visual Settings

- **Font Configuration**:
  - Adjustable font size
  - Customizable font family
- **Color Schemes**: Multiple terminal color themes
- **Cursor Behavior**: Configurable cursor style and blinking
- **Scrollback Buffer**: Adjustable buffer size for history

### Layout Options

- **Header Display**: Customizable header with text and styling
- **Window Management**: Responsive terminal sizing
- **Full-screen Support**: Maximize terminal view

## Authentication Features

### Supported Methods

- **Password Authentication**: Standard username/password
- **Private Key Authentication**: SSH key-based login
- **Keyboard-Interactive**: Support for 2FA and MFA
- **Credential Replay**: Automatic reauthentication support

### Security Features

- **Encrypted Communication**: WebSocket over TLS (WSS)
- **Session Isolation**: Secure session management
- **No Credential Storage**: Credentials not persisted client-side

## URL Parameters

The client supports extensive URL parameter configuration:

### Connection Parameters

- `host`: SSH server hostname
- `port`: SSH server port (default: 22)
- `username`: SSH username (optional)
- `sshterm`: Terminal type (default: xterm-color)

### Header Customization

- `header`: Header text to display
- `headerStyle`: Complete header styling with Tailwind CSS classes
- `headerBackground`: Legacy header background styling

See [URL Parameters Documentation](../configuration/URL-PARAMETERS.md) for detailed header styling options.

## Keyboard Shortcuts

### Terminal Control

- **Copy**: `Ctrl+Shift+C` (Windows/Linux) or `⌘+Shift+C` (macOS)
- **Paste**: `Ctrl+Shift+V` (Windows/Linux) or `⌘+Shift+V` (macOS)
- **Search**: `Ctrl+F` (Windows/Linux) or `⌘F` (macOS)
- **Find Next**: `F3` or `Enter` in search
- **Find Previous**: `Shift+F3` or `Shift+Enter` in search

### Session Management

- **Disconnect**: Available through menu
- **Download Log**: Export session history
- **Settings**: Access terminal configuration

## Configuration Storage

### LocalStorage Settings

Settings are persisted in browser localStorage under `webssh2.settings.global`:

```javascript
{
  // Terminal appearance
  fontSize: 14,
  fontFamily: 'Courier New, monospace',
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 1000,
  
  // Clipboard behavior
  clipboardAutoSelectToCopy: true,
  clipboardEnableMiddleClickPaste: true,
  clipboardEnableKeyboardShortcuts: true,
  
  // Color scheme
  theme: 'default'
}
```

### Programmatic Configuration

```javascript
// Read current settings
const settings = JSON.parse(
  localStorage.getItem('webssh2.settings.global') || '{}'
)

// Update settings
settings.fontSize = 16
settings.clipboardAutoSelectToCopy = false

// Save settings
localStorage.setItem('webssh2.settings.global', JSON.stringify(settings))
```

## Performance Features

- **Efficient Rendering**: Hardware-accelerated terminal rendering
- **WebSocket Optimization**: Binary frame support for better performance
- **Lazy Loading**: Resources loaded on demand
- **Memory Management**: Automatic scrollback buffer management

## Accessibility

- **Screen Reader Support**: Basic compatibility with assistive technologies
- **Keyboard Navigation**: Full keyboard control without mouse
- **High Contrast**: Support for system high-contrast modes
- **Zoom Support**: Terminal scales with browser zoom

## Browser Compatibility

### Minimum Requirements

- **Chrome/Edge**: Version 90+
- **Firefox**: Version 88+
- **Safari**: Version 14+
- **Opera**: Version 76+

### Required Features

- WebSocket support
- ES6/ES2015+ JavaScript
- Clipboard API (for clipboard features)
- LocalStorage API
- CSS Grid and Flexbox

## File Transfer

WebSSH2 includes integrated SFTP support for file uploads and downloads directly through the web interface.

### Features

- **File Browser**: Graphical directory navigation
- **Upload**: Drag-and-drop or file picker upload
- **Download**: One-click file downloads
- **Directory Operations**: Create and delete folders
- **Progress Tracking**: Real-time transfer progress

See [SFTP Documentation](./SFTP.md) for complete details.

## Known Limitations

1. **Clipboard Security**: Some browsers restrict clipboard access without user interaction
2. **Mobile Support**: Limited functionality on mobile devices
3. **Multiple Sessions**: Each browser tab is a separate session

## Troubleshooting

For common issues and solutions, see:
- [Troubleshooting Guide](../reference/TROUBLESHOOTING.md)
- [Browser Clipboard Issues](../reference/TROUBLESHOOTING.md#copypaste-not-working)