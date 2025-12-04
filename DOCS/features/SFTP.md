# SFTP File Transfer

WebSSH2 includes an integrated SFTP file browser that allows you to upload and download files directly through the web interface.

## Overview

The SFTP feature provides a graphical file browser panel below the terminal, enabling file operations without leaving the web terminal session. It uses the same authenticated SSH connection as your terminal session.

> **Note:** SFTP is **disabled by default**. Administrators must explicitly enable it by setting `ssh.sftp.enabled` to `true` in the configuration or by setting the environment variable `WEBSSH2_SSH_SFTP_ENABLED=true`.

## Accessing the File Browser

### Opening the File Browser

1. Click the **Menu** button in the bottom-left corner
2. Select **File Browser** from the menu
3. The file browser panel appears below the terminal

> **Note**: The File Browser option only appears if SFTP is enabled on the server. If you don't see it, contact your administrator.

### Closing the File Browser

- Click the **X** button in the top-right corner of the file browser toolbar
- The terminal will expand to fill the available space

## File Browser Interface

### Toolbar

The toolbar at the top of the file browser provides:

| Icon | Function | Description |
|------|----------|-------------|
| **←** | Back | Navigate to the parent directory |
| **Home** | Home | Navigate to your home directory (~) |
| **Path Bar** | Current Path | Shows the current directory path |
| **Refresh** | Refresh | Reload the current directory listing |
| **Eye** | Toggle Hidden | Show/hide hidden files (dotfiles) |
| **Folder+** | New Folder | Create a new directory |
| **Upload** | Upload | Open file picker to upload files |
| **X** | Close | Close the file browser panel |

### File List

The file list displays:

- **Icon**: Visual indicator of file type (folder, file, script, etc.)
- **Name**: File or directory name
- **Size**: File size (directories show `--`)
- **Modified**: Last modification date and time
- **Permissions**: Unix permission string (e.g., `rwxr-xr-x`)
- **Actions**: Download and delete buttons

### File Types and Icons

Different file types are indicated by icons:

- **Folders**: Folder icon
- **Scripts**: Lightning bolt icon (`.sh`, `.bash`, `.zsh`)
- **Code Files**: Code icon (`.js`, `.ts`, `.py`, `.go`, etc.)
- **Config Files**: Gear icon (`.json`, `.yaml`, `.xml`, etc.)
- **Documents**: Document icon (`.txt`, `.md`, `.pdf`)
- **Archives**: Package icon (`.zip`, `.tar`, `.gz`)
- **Images**: Image icon (`.jpg`, `.png`, `.gif`)
- **Media**: Music/video icons

## File Operations

### Navigating Directories

- **Click** a folder to open it
- Click **..** or **←** (parent entry) to go up one level
- Use the **Home** button to return to your home directory
- Type a path directly in the path bar and press Enter

### Viewing File Details

Click on any **file** (not folder) to open a detailed information modal that displays:

| Field | Description |
|-------|-------------|
| **File Name** | Name with file type icon |
| **Path** | Full path to the file |
| **Size** | File size in human-readable format |
| **Modified** | Date the file was last modified |
| **Time** | Time the file was last modified |
| **Permissions** | Unix permission string (e.g., `rwxr-xr-x`) |
| **Owner** | File owner username |
| **Group** | File group name |

The modal includes action buttons:
- **Download** - Download the file to your computer
- **Delete** - Delete the file (with confirmation prompt)

> **Tip**: Use the file info modal for a cleaner view of file details, especially on smaller screens where some columns may be hidden in the list view.

### Downloading Files

1. Locate the file you want to download
2. Click the **download icon** (↓) on the file's row
3. The browser will prompt you to save the file
4. A progress indicator shows the download status

### Uploading Files

#### Using the Upload Button

1. Click the **Upload** button in the toolbar
2. Select one or more files from your computer
3. Files are uploaded to the current directory

#### Using Drag and Drop

1. Drag files from your desktop or file manager
2. Drop them onto the file browser area
3. A blue overlay indicates the drop zone
4. Files are uploaded to the current directory

> **Tip**: You can drag and drop multiple files at once to upload them simultaneously.

### Creating Folders

1. Click the **New Folder** button (folder+ icon)
2. Enter the folder name in the input field
3. Press Enter or click the checkmark to create
4. Press Escape or click X to cancel

### Deleting Files and Folders

1. Click the **trash** icon on the file's row
2. The file or folder is deleted immediately

> **Warning**: Deletion is immediate and cannot be undone. Be careful when deleting files.
>
> **Note**: Recursive directory deletion is not supported for safety reasons. You must empty a directory before deleting it. Attempting to delete a non-empty directory will result in an error.

### Showing Hidden Files

- Click the **eye** icon to toggle hidden file visibility
- Hidden files (starting with `.`) are shown/hidden
- The icon changes to indicate the current state

## Transfer Progress

### Active Transfers

When files are being uploaded or downloaded, a transfer panel appears at the bottom:

- **File Name**: Name of the file being transferred
- **Progress Bar**: Visual indicator of transfer progress
- **Size**: Bytes transferred / Total size
- **Status**: Current transfer state

### Transfer States

| Status | Description |
|--------|-------------|
| **Pending** | Transfer queued, waiting to start |
| **Active** | Transfer in progress |
| **Complete** | Transfer finished successfully |
| **Failed** | Transfer encountered an error |
| **Cancelled** | Transfer was cancelled by user |

### Managing Transfers

- **Cancel**: Click the X button on an active transfer to cancel it
- **Clear Completed**: Click "Clear completed" to remove finished transfers from the list

## Server Configuration

The SFTP feature behavior is controlled by server configuration. Administrators can set:

| Setting | Description | Default |
|---------|-------------|---------|
| `enabled` | Enable/disable SFTP feature | `false` |
| `maxFileSize` | Maximum file size for transfers | 100 MB |
| `chunkSize` | Transfer chunk size | 32 KB |
| `maxConcurrentTransfers` | Max simultaneous transfers | 2 |
| `allowedPaths` | Restrict access to specific paths | All paths |
| `blockedExtensions` | Block specific file extensions | None |

> **Note**: If you encounter restrictions, contact your administrator about the server configuration.

## Error Messages

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| **SFTP is not enabled** | SFTP disabled on server | Contact administrator |
| **File or directory not found** | Path doesn't exist | Check the path and refresh |
| **Permission denied** | Insufficient permissions | Check file/directory permissions |
| **File too large** | Exceeds server limit | Use a smaller file or contact admin |
| **Path not allowed** | Path restriction in effect | Navigate to an allowed directory |
| **Extension blocked** | File type not permitted | Contact administrator |

### Troubleshooting

1. **File Browser doesn't appear in menu**
   - SFTP may be disabled on the server
   - Contact your administrator

2. **Directory listing is empty or incomplete**
   - Try clicking the Refresh button
   - Check if you have read permissions
   - Directory is actually empty

3. **Upload fails immediately**
   - Check if you have write permissions
   - Verify file size is within limits
   - Check if file extension is allowed

4. **Download doesn't start**
   - Ensure browser allows downloads
   - Check popup blocker settings
   - Try a different browser

## Keyboard Shortcuts

Currently, the file browser supports mouse-based interaction. Keyboard navigation may be added in future versions.

## Security Considerations

- **Same Session**: SFTP uses your existing SSH authentication
- **No Additional Login**: No separate credentials required
- **Server Permissions**: File operations respect server-side permissions
- **Path Restrictions**: Administrators can limit accessible paths
- **Extension Filtering**: Dangerous file types can be blocked

## Limitations

1. **No Folder Download**: Downloading entire folders is not supported
2. **No Rename**: File renaming is not available (use terminal)
3. **No Move/Copy**: Moving or copying files requires terminal commands
4. **Single Selection**: Multi-file selection for batch operations is limited
5. **No Resume**: Interrupted transfers cannot be resumed

## Performance

### Download Optimization

WebSSH2 uses parallel chunk reads for downloads, similar to SSH2's `fastGet` approach. This significantly improves download speeds by hiding network latency through request pipelining.

**Technical Details:**

- Downloads use 32 concurrent read requests in-flight
- Chunks are buffered and emitted in order to maintain file integrity
- This approach can achieve 50-100 MB/s on low-latency connections

### Upload Performance

Uploads stream data in configurable chunks (default 32KB) with acknowledgment-based flow control.

### Factors Affecting Speed

1. **Network latency**: Lower latency = better parallel read efficiency
2. **Chunk size**: Larger chunks reduce overhead but use more memory
3. **Rate limiting**: Server-configured limits may throttle transfers
4. **SSH server configuration**: Some servers limit concurrent SFTP requests

## Tips and Best Practices

1. **Large Files**: WebSSH2 handles large files efficiently with parallel transfers
2. **Many Files**: For bulk transfers, create an archive first
3. **Permissions**: Use `chmod`/`chown` in terminal for permission changes
4. **Symbolic Links**: Links are displayed but follow to their target
5. **Refresh Often**: Click refresh if the directory was modified externally

## Related Documentation

- [Configuration Guide](../configuration/CONFIG-JSON.md) - Server SFTP settings
- [Environment Variables](../configuration/ENVIRONMENT-VARIABLES.md) - SFTP environment configuration
- [Client Features](./CLIENT-FEATURES.md) - Other client capabilities
