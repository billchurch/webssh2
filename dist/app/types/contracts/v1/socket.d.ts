export interface AuthCredentials {
    username: string;
    host: string;
    port: number;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    term?: string;
    cols?: number;
    rows?: number;
}
export interface TerminalSettings {
    term?: string;
    cols?: number;
    rows?: number;
}
export interface ExecRequestPayload {
    command: string;
    pty?: boolean;
    term?: string;
    cols?: number;
    rows?: number;
    env?: Record<string, string>;
    timeoutMs?: number;
}
export interface ExecDataPayload {
    type: 'stdout' | 'stderr';
    data: string;
}
export interface ExecExitPayload {
    code: number | null;
    signal: string | null;
}
export interface ClientToServerEvents {
    data: (chunk: string) => void;
    resize: (size: {
        cols: number;
        rows: number;
    }) => void;
    terminal: (settings: TerminalSettings) => void;
    control: (msg: 'replayCredentials' | 'reauth') => void;
    authenticate: (creds: AuthCredentials) => void;
    exec: (payload: ExecRequestPayload) => void;
}
export type AuthenticationEvent = {
    action: 'request_auth';
} | {
    action: 'auth_result';
    success: boolean;
    message?: string;
} | {
    action: 'keyboard-interactive';
    name?: string;
    instructions?: string;
    prompts?: Array<{
        prompt: string;
        echo: boolean;
    }>;
};
export interface ServerToClientEvents {
    data: (chunk: string) => void;
    authentication: (payload: AuthenticationEvent) => void;
    permissions: (p: {
        autoLog: boolean;
        allowReplay: boolean;
        allowReconnect: boolean;
        allowReauth: boolean;
    }) => void;
    updateUI: (payload: {
        element: string;
        value: unknown;
    }) => void;
    getTerminal: (open: boolean) => void;
    'exec-data': (payload: ExecDataPayload) => void;
    'exec-exit': (payload: ExecExitPayload) => void;
    ssherror: (message: string) => void;
    error?: (message: string) => void;
}
export interface InterServerEvents {
}
export interface SocketData {
    sessionId?: string;
}
