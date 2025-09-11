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
    data: (_chunk: string) => void;
    resize: (_size: {
        cols: number;
        rows: number;
    }) => void;
    control: (_msg: unknown) => void;
    exec: (_payload: ExecRequestPayload) => void;
}
export interface ServerToClientEvents {
    data: (_chunk: string) => void;
    'exec-data': (_payload: ExecDataPayload) => void;
    'exec-exit': (_payload: ExecExitPayload) => void;
    error?: (_message: string) => void;
}
export interface InterServerEvents {
}
export interface SocketData {
    sessionId?: string;
}
