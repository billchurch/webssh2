# Keyboard Capture - Quick Reference

> **Full Documentation**: See [KEYBOARD_CAPTURE.md](./KEYBOARD_CAPTURE.md) for comprehensive details.

## Overview

Control which keyboard events are sent to the terminal vs. handled by the web UI. Essential for tmux, tmux, vim, and other terminal applications.

**Addresses**: [GitHub Issue #455](https://github.com/billchurch/webssh2/issues/455) - tmux Escape key focus issue

## Quick Start

### Access Settings

1. **During Session**: Menu (☰) → Settings → Expand "Keyboard Capture Settings"
2. **During Login**: Click gear icon (⚙️) → Expand "Keyboard Capture Settings"

### Common Configurations

**General terminal Users**:
```
☑ Capture Escape: Enabled
☐ Capture Ctrl+B: Disabled
Custom Keys: (leave empty)
```

**For tmux Users**:
```
☐ Capture Escape: Disabled
☑ Capture Ctrl+B: Enabled
Custom Keys: (leave empty)
```

**For Power Users**:
```
☑ Capture Escape: Enabled
☑ Capture Ctrl+B: Enabled
Custom Keys: F11, Ctrl+T, Alt+D
```

## Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| **Capture Escape** | `false` | Send ESC to terminal instead of closing modals/search |
| **Capture Ctrl+B** | `false` | Send Ctrl+B to terminal instead of browser bookmarks |
| **Custom Keys** | `[]` | Comma-separated list of additional keys to capture |

## Key Notation

- **Modifiers**: `Ctrl`, `Alt`, `Shift`, `Meta` (or `Cmd`)
- **Keys**: `A`, `B`, `F1`, `F11`, `Escape`, `Enter`, etc.
- **Combinations**: Use `+` (e.g., `Ctrl+Shift+C`, `Alt+F4`)

## Examples

```
F11                    → Capture F11 key
Ctrl+T                 → Capture Ctrl+T (new tab)
Alt+D                  → Capture Alt+D (address bar)
Shift+F1, Shift+F2     → Multiple keys
```

## UI Changes When Enabled

### Escape Captured
- ✗ ESC no longer closes modals/search
- ✓ Use X button or backdrop click instead
- ✓ ESC sent directly to vim/emacs/terminal

### Ctrl+B Captured
- ✗ Ctrl+B no longer opens bookmarks
- ✓ Use browser menu or Ctrl+Shift+B instead
- ✓ Ctrl+B sent to tmux/tmux

## Debug

Enable debug logging in browser console:

```javascript
localStorage.debug = 'webssh2-client:keyboard-capture'
```

View current settings:

```javascript
JSON.parse(localStorage.getItem('webssh2.settings.global'))
```

## Limitations

**Cannot override** (browser security):
- Ctrl+W (close tab)
- Ctrl+N (new window)
- F12 (DevTools)

Use alternative bindings in your terminal application for these keys.

## Related Links

- [Full Keyboard Capture Documentation](./KEYBOARD_CAPTURE.md)
- [Client Features](../features/CLIENT-FEATURES.md)
- [GitHub Issue #455](https://github.com/billchurch/webssh2/issues/455)
