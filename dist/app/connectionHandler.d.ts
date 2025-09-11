import type { Request, Response } from 'express';
type Sess = {
    [k: string]: unknown;
};
export default function handleConnection(req: Request & {
    session?: Sess;
    sessionID?: string;
}, res: Response, opts?: {
    host?: string;
}): Promise<void>;
export {};
