import type { WebSSH2Request, WebSSH2Response } from './types/express.js';
/**
 * Handle the connection request and send the modified client HTML.
 * @param req - The Express request object.
 * @param res - The Express response object.
 */
declare function handleConnection(req: WebSSH2Request, res: WebSSH2Response): Promise<void>;
export default handleConnection;
//# sourceMappingURL=connectionHandler.d.ts.map