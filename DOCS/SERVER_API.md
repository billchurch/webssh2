# WebSSH2 Server API Documentation

## Overview

The WebSSH2 server provides a WebSocket interface for establishing SSH connections. This API documentation outlines the events and data structures used for communication between the client and the server.

Currently this implementation requires Socket.IO v2.2.0 due to this instance targeting node 6.9.1 for a legacy project. Future releases will not have this limitation.

## Connection

The server uses Socket.IO for real-time communication. Connect to the WebSocket server at the same host and port as the HTTP server, with the path `/ssh/socket.io`.

## Events

### Server to Client Events

1. `authentication`
   - Emitted to request authentication or provide authentication results.
   - Payload:
     ```javascript
     {
       action: string, // "request_auth" or "auth_result"
       success?: boolean, // Only present for "auth_result"
       message?: string // Error message if authentication fails
     }
     ```

2. `permissions`
   - Emitted after successful authentication to provide allowed actions.
   - Payload:
     ```javascript
     {
       autoLog: boolean,
       allowReplay: boolean,
       allowReconnect: boolean,
       allowReauth: boolean
     }
     ```

3. `getTerminal`
   - Emitted to request terminal specifications from the client.
   - Payload: `true`

4. `data`
   - Emitted when there's output from the SSH session.
   - Payload: `string` (UTF-8 encoded terminal output)

5. `ssherror`
   - Emitted when an SSH-related error occurs.
   - Payload: `string` (Error message)

6. `updateUI`
   - Emitted to update specific UI elements.
   - Payload:
     ```javascript
     {
       element: string, // UI element identifier
       value: any // New value for the element
     }
     ```

### Client to Server Events

1. `authenticate`
   - Emit this event to provide authentication credentials.
   - Payload:
     ```javascript
     {
       username: string,
       password: string,
       host: string,
       port: number,
       term?: string, // Optional terminal type
       cols?: number, // Optional terminal columns (added for early dimension setup)
       rows?: number  // Optional terminal rows (added for early dimension setup)
     }
     ```

2. `terminal`
   - Emit this event to provide terminal specifications.
   - Payload:
     ```javascript
     {
       term: string, // e.g., "xterm-256color"
       cols: number,
       rows: number
     }
     ```

3. `data`
   - Emit this event to send user input to the SSH session.
   - Payload: `string` (UTF-8 encoded user input)

4. `resize`
   - Emit this event when the terminal size changes.
   - Payload:
     ```javascript
     {
       cols: number,
       rows: number
     }
     ```

5. `control`
   - Emit this event for special control commands.
   - Payload: `string` ("replayCredentials" or "reauth")

6. `disconnect`
   - Emit this event to close the connection.
   - No payload required

## Authentication Flow

1. The server emits `authentication` with `action: "request_auth"`.
2. The client emits `authenticate` with credentials.
3. The server may emit `authentication` with `action: "keyboard-interactive"` for additional authentication steps.
4. The server emits `authentication` with `action: "auth_result"` and `success: true/false`.

## Establishing SSH Session

1. After successful authentication, the server emits `getTerminal`.
2. The client emits `terminal` with terminal specifications.
3. The server establishes the SSH connection and starts emitting `data` events with terminal output.
4. The client can now send `data` events with user input.

## Error Handling

- The client should listen for `ssherror` events and handle them appropriately (e.g., displaying error messages to the user).

## UI Updates

- The client should listen for `updateUI` events and update the corresponding UI elements.

## Best Practices

1. Handle connection errors and implement reconnection logic.
2. Implement proper error handling and user feedback.
3. Securely manage authentication credentials.
4. Handle terminal resizing appropriately.
5. Implement support for special control commands (replay credentials, reauthentication).
