import type { Request, Response } from 'express';
type Sess = {
    usedBasicAuth?: boolean;
    sshCredentials?: {
        host?: string;
        port?: number;
        term?: string | null;
    };
    [k: string]: unknown;
};
export default function handleConnection(req: Request & {
    session?: Sess;
    sessionID?: string;
}, res: Response, _opts?: {
    host?: string;
}): Promise<void>;
export {};
