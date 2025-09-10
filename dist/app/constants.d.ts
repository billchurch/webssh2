/**
 * Error messages
 */
export declare const MESSAGES: {
    readonly INVALID_CREDENTIALS: "Invalid credentials format";
    readonly SSH_CONNECTION_ERROR: "SSH CONNECTION ERROR";
    readonly SHELL_ERROR: "SHELL ERROR";
    readonly CONFIG_ERROR: "CONFIG_ERROR";
    readonly UNEXPECTED_ERROR: "An unexpected error occurred";
    readonly EXPRESS_APP_CONFIG_ERROR: "Failed to configure Express app";
    readonly CLIENT_FILE_ERROR: "Error loading client file";
    readonly FAILED_SESSION_SAVE: "Failed to save session";
    readonly CONFIG_VALIDATION_ERROR: "Config validation error";
};
/**
 * Default values
 */
export declare const DEFAULTS: {
    readonly SSH_PORT: 22;
    readonly LISTEN_PORT: 2222;
    readonly SSH_TERM: "xterm-color";
    readonly IO_PING_TIMEOUT: 60000;
    readonly IO_PING_INTERVAL: 25000;
    readonly IO_PATH: "/ssh/socket.io";
    readonly WEBSSH2_CLIENT_PATH: string;
    readonly CLIENT_FILE: "client.htm";
    readonly MAX_AUTH_ATTEMPTS: 2;
};
/**
 * HTTP Related
 */
export declare const HTTP: {
    readonly OK: 200;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly AUTHENTICATE: "WWW-Authenticate";
    readonly REALM: "Basic realm=\"WebSSH2\"";
    readonly AUTH_REQUIRED: "Authentication required.";
    readonly COOKIE: "basicauth";
    readonly PATH: "/ssh/host/";
    readonly SAMESITE: "Strict";
    readonly SESSION_SID: "webssh2_sid";
    readonly CREDENTIALS_CLEARED: "Credentials cleared.";
};
export type MessageKeys = keyof typeof MESSAGES;
export type DefaultKeys = keyof typeof DEFAULTS;
export type HttpKeys = keyof typeof HTTP;
//# sourceMappingURL=constants.d.ts.map