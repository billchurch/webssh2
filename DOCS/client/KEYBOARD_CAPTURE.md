# Keyboard Capture Configuration

## Overview

The WebSSH2 client includes a **Keyboard Capture** feature that allows users to control which keyboard events are sent directly to the terminal versus being handled by the web UI. This is particularly useful for applications like tmux, tmux, vim, and other terminal-based tools that rely on specific keyboard shortcuts.

**Feature addresses:** [GitHub Issue #455](https://github.com/billchurch/webssh2/issues/455)

## Problem Statement

By default, certain keyboard events are intercepted by the WebSSH2 web interface:

- **Escape key**: Closes modals and search dialogs instead of being sent to the terminal
- **Ctrl+B**: Opens browser bookmarks instead of being sent to tmux/tmux
- **Other shortcuts**: May trigger browser or UI actions instead of terminal applications

This behavior can disrupt workflows in terminal applications like:
- **general terminal**: Requires Escape for vim and other editors
- **tmux**: Uses Ctrl+B as the default prefix key
- **vim/emacs**: Rely on numerous keyboard shortcuts
- **Custom terminal applications**: May define their own keyboard shortcuts

## Solution: Keyboard Capture Settings

The Keyboard Capture feature provides three levels of control:

1. **Capture Escape**: Prevents Escape from closing modals/search, sends it to the terminal
2. **Capture Ctrl+B**: Prevents Ctrl+B from opening browser bookmarks, sends it to the terminal
3. **Custom Capture Keys**: User-defined list of keys to capture (e.g., `F11`, `Ctrl+T`, `Alt+D`)

## Accessing Keyboard Capture Settings

### During an Active Session

1. Click the **menu icon (☰)** in the bottom-left corner of the terminal
2. Select **"Settings"** from the dropdown menu
3. Expand the **"Keyboard Capture Settings"** section

### During Login

1. In the login dialog, click the **gear icon (⚙️)** next to the "Connect" button
2. Expand the **"Keyboard Capture Settings"** section

## Configuration Options

### 1. Capture Escape

**Purpose**: Send Escape key directly to the terminal instead of closing UI elements.

**Options**:
- **Enabled**: Escape is sent to the terminal; modals/search must be closed using close buttons
- **Disabled (default)**: Escape closes modals and search (standard web behavior)

**Use Case**: Essential for tmux users and anyone using vim, emacs, or other editors that rely on Escape.

**Example**:
```
When enabled:
- Pressing ESC in vim → exits insert mode (✓)
- Pressing ESC in search → goes to terminal (not search close)
- Modals can be closed with the X button or backdrop click
```

### 2. Capture Ctrl+B

**Purpose**: Send Ctrl+B directly to the terminal instead of opening browser bookmarks.

**Options**:
- **Enabled**: Ctrl+B is sent to the terminal
- **Disabled (default)**: Ctrl+B opens browser bookmarks (standard browser behavior)

**Use Case**: Critical for tmux users (default prefix key) and tmux workflows.

**Example**:
```
When enabled:
- Ctrl+B → sent to tmux as prefix key (✓)
- Browser bookmarks can be accessed via browser menu or Alt+D → Ctrl+B
```

### 3. Custom Capture Keys

**Purpose**: Define additional keyboard shortcuts to capture and send to the terminal.

**Format**: Comma-separated list of key combinations.

**Examples**:
```
F11                    → Full-screen toggle
Ctrl+T                 → Browser new tab
Alt+D                  → Browser address bar
Shift+F1, Shift+F2     → Multiple keys
Ctrl+Shift+N           → Browser incognito mode
```

**Key Notation**:
- Modifiers: `Ctrl`, `Alt`, `Shift`, `Meta` (or `Cmd`)
- Regular keys: `A`, `B`, `1`, `F1`, `F11`, `Escape`, `Enter`, etc.
- Combinations: Use `+` to combine (e.g., `Ctrl+Shift+C`)

**Use Case**: Custom terminal applications or workflows that conflict with browser shortcuts.

## How It Works

### Technical Implementation

The keyboard capture system operates at the event handler level:

1. **Event Interception**: Global keyboard event listeners check each keystroke
2. **Settings Lookup**: Loads keyboard capture settings from localStorage
3. **Match Detection**: Compares the event against capture rules using the `shouldCaptureKey()` function
4. **Early Return**: If matched, the event is **not** handled by UI components (modals, search, etc.)
5. **Terminal Passthrough**: The keystroke passes through to the xterm.js terminal instance

### Code Location

Implementation files in `webssh2_client`:

```
client/src/
├── types/config.d.ts                          # KeyboardCaptureSettings interface
├── utils/keyboard-capture.ts                  # Core capture logic
├── utils/index.ts                             # Default settings
├── app.tsx                                    # Global keyboard handler
├── components/
│   ├── Modal.tsx                              # Modal Escape handling
│   ├── TerminalSearch.tsx                     # Search Escape handling
│   └── TerminalSettingsModal.tsx              # Settings UI
```

### Key Functions

**`shouldCaptureKey(event, settings): boolean`**

Pure function that determines if a keyboard event should be captured:

```typescript
export function shouldCaptureKey(
  event: KeyboardEvent,
  settings: KeyboardCaptureSettings
): boolean {
  // Check for Escape key
  if (settings.captureEscape && event.key === 'Escape') {
    return true
  }

  // Check for Ctrl+B
  if (
    settings.captureCtrlB &&
    event.key.toLowerCase() === 'b' &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey
  ) {
    return true
  }

  // Check custom capture keys
  for (const keyString of settings.customCaptureKeys) {
    const parsed = parseKeyString(keyString)
    if (parsed && matchesKeyString(event, parsed)) {
      return true
    }
  }

  return false
}
```

## Storage and Persistence

### LocalStorage Key

Settings are stored under: `webssh2.settings.global`

### Default Values

```json
{
  "keyboardCapture": {
    "captureEscape": false,
    "captureCtrlB": false,
    "customCaptureKeys": []
  }
}
```

### Cross-Device Behavior

Settings are **browser-specific** and stored in localStorage. If you use WebSSH2 on:
- Different browsers → Settings must be configured separately
- Different devices → Settings must be configured separately
- Incognito/Private mode → Settings are temporary and lost after session

## Common Use Cases

### Use Case 1: tmux with vim

**Problem**: Pressing Escape in vim doesn't exit insert mode because it closes the search dialog.

**Solution**:
1. Enable **"Capture Escape"** in Keyboard Capture Settings
2. Save settings
3. Now Escape works in vim, search must be closed with X button

### Use Case 2: tmux Sessions

**Problem**: Ctrl+B opens browser bookmarks instead of activating tmux prefix.

**Solution**:
1. Enable **"Capture Ctrl+B"** in Keyboard Capture Settings
2. Save settings
3. Now Ctrl+B works as tmux prefix

### Use Case 3: Full-screen Terminal

**Problem**: F11 toggles browser full-screen, interfering with terminal application shortcuts.

**Solution**:
1. Add `F11` to **"Custom Keys"** field
2. Save settings
3. Now F11 is sent to the terminal application

### Use Case 4: Complex Development Workflow

**Scenario**: Developer using multiple conflicting shortcuts.

**Configuration**:
```
Capture Escape: Enabled
Capture Ctrl+B: Enabled
Custom Keys: F11, Ctrl+T, Ctrl+Shift+N, Alt+D
```

**Result**: All specified keys are sent to terminal, browser shortcuts disabled while terminal has focus.

## UI Behavior Changes

### When Capture Escape is Enabled

**Modals**:
- ✗ Pressing Escape → No effect (key sent to terminal)
- ✓ Click X button → Closes modal
- ✓ Click backdrop → Closes modal (if enabled)

**Search**:
- ✗ Pressing Escape → No effect (key sent to terminal)
- ✓ Click X button → Closes search
- ✓ Ctrl+F / Cmd+F → Opens search (still works)

**Error Dialogs**:
- ✗ Pressing Escape → No effect (key sent to terminal)
- ✓ Click "Close" button → Closes dialog

### When Capture Ctrl+B is Enabled

**Browser**:
- ✗ Ctrl+B → No effect (key sent to terminal)
- ✓ Alt+B or Menu → Bookmarks → Opens bookmarks
- ✓ Ctrl+Shift+B → Bookmarks bar toggle (modifier difference)

**Terminal**:
- ✓ Ctrl+B → Sent to tmux/tmux/application

## Troubleshooting

### Issue: Escape still closes search/modals

**Cause**: Keyboard Capture settings not saved or not loaded.

**Solution**:
1. Open Terminal Settings → Keyboard Capture
2. Verify "Capture Escape" is set to "Enabled"
3. Click "Save" (not just "Cancel")
4. Refresh page and test again

### Issue: Custom keys not working

**Cause**: Invalid key notation or parsing error.

**Solution**:
1. Check key notation format: `Modifier+Key` (e.g., `Ctrl+T`, not `Control-T`)
2. Use proper capitalization for modifiers: `Ctrl`, `Alt`, `Shift`, `Meta`
3. Ensure keys are comma-separated: `F11, Ctrl+T, Alt+D`
4. Check browser console for debug messages (enable debug: `localStorage.debug = 'webssh2-client:*'`)

### Issue: Settings not persisting

**Cause**: LocalStorage disabled or cleared.

**Solution**:
1. Check browser privacy settings allow localStorage
2. Check browser extensions (some privacy extensions block localStorage)
3. Avoid incognito/private mode for persistent settings

### Issue: Some keys still trigger browser actions

**Cause**: Some browser shortcuts cannot be overridden (security restrictions).

**Examples**:
- Ctrl+W (close tab) - Cannot be overridden
- Ctrl+N (new window) - Cannot be overridden
- F12 (DevTools) - Cannot be overridden on most browsers

**Solution**: Use alternative key bindings in your terminal application for these restricted keys.

## Security Considerations

### XSS Prevention

The keyboard capture system uses **pure functions** and **validated input**:

- Custom key parsing uses strict regex and validation
- No `eval()` or dynamic code execution
- No DOM manipulation based on user input
- All settings stored in JSON format in localStorage

### CSP Compliance

The implementation follows the existing Content Security Policy:
- No inline scripts
- No `innerHTML` or DOM injection
- Event handlers registered programmatically
- Settings UI uses controlled components

## Debugging

### Enable Debug Logging

To see keyboard capture decisions in the browser console:

```javascript
// In browser console
localStorage.debug = 'webssh2-client:keyboard-capture'
// Refresh page
```

### Debug Output Examples

```
webssh2-client:keyboard-capture Capturing Escape key for terminal +0ms
webssh2-client:keyboard-capture Capturing Ctrl+B for terminal +150ms
webssh2-client:keyboard-capture Capturing custom key "F11" for terminal +300ms
```

### Inspecting Settings

To view current settings:

```javascript
// In browser console
JSON.parse(localStorage.getItem('webssh2.settings.global'))
```

Expected output:
```json
{
  "keyboardCapture": {
    "captureEscape": true,
    "captureCtrlB": true,
    "customCaptureKeys": ["F11", "Ctrl+T"]
  },
  "fontSize": 14,
  "fontFamily": "courier-new, courier, monospace",
  ...
}
```

## API Reference

### Type Definitions

```typescript
export interface KeyboardCaptureSettings {
  captureEscape: boolean          // Capture Escape key
  captureCtrlB: boolean            // Capture Ctrl+B
  customCaptureKeys: string[]      // User-defined keys
}

export interface TerminalSettings {
  // ... other settings ...
  keyboardCapture: KeyboardCaptureSettings
}
```

### Functions

**`parseKeyString(keyString: string): ParsedKeyString | null`**

Parses a key string into structured format.

```typescript
parseKeyString('Ctrl+B')
// Returns: { key: 'b', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }
```

**`matchesKeyString(event: KeyboardEvent, parsedKey: ParsedKeyString): boolean`**

Checks if a keyboard event matches a parsed key.

**`shouldCaptureKey(event: KeyboardEvent, settings: KeyboardCaptureSettings): boolean`**

Main function that determines if a key should be captured by the terminal.

## Related Documentation

- [WebSSH2 Client Features](../webssh2_client/DOCS/FEATURES.md)
- [Terminal Settings](../webssh2_client/DOCS/FEATURES.md#terminal-configuration)
- [GitHub Issue #455](https://github.com/billchurch/webssh2/issues/455) - Original feature request

## Version History

- **v2.5.0** (Expected): Initial keyboard capture feature implementation
  - Added capture Escape setting
  - Added capture Ctrl+B setting
  - Added custom capture keys
  - Updated Terminal Settings UI with collapsible sections
