# Application Flow

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant SocketIO
    participant SSHConnection
    participant SSHServer

    Client->>Express: HTTP Request
    Express->>Client: Send client files
    Client->>SocketIO: Establish Socket.IO connection
    alt HTTP Basic Auth used
        Note over SocketIO: Server has term from URL params
        SocketIO->>SSHConnection: Jump to "Connect with credentials"
    else No pre-existing credentials
        SocketIO->>Client: Emit "authentication" (request_auth)
        Client->>SocketIO: Emit "authenticate" (with credentials + optional term/cols/rows)
        Note over SocketIO: Server stores term from credentials
    end
    SocketIO->>SSHConnection: Connect with credentials
    SSHConnection->>SSHServer: Establish SSH connection
    alt Keyboard Interactive Auth
        SSHServer->>SSHConnection: Request additional auth
        SSHConnection->>SocketIO: Emit "authentication" (keyboard-interactive)
        SocketIO->>Client: Forward auth request
        Client->>SocketIO: Send auth response
        SocketIO->>SSHConnection: Forward auth response
        SSHConnection->>SSHServer: Complete authentication
    end
    SSHServer->>SSHConnection: Connection established
    SSHConnection->>SocketIO: Connection successful
    SocketIO->>Client: Emit "authentication" (success)
    SocketIO->>Client: Emit "getTerminal"
    Client->>SocketIO: Emit "terminal" (with dimensions only)
    SocketIO->>SSHConnection: Create shell with server-side term + client dimensions
    SSHConnection->>SSHServer: Create shell session
    SSHConnection->>SocketIO: Shell created
    SocketIO->>Client: Ready for input/output
    Note over Client,SSHServer: Bidirectional data flow established
```