import { promises as fs } from 'fs';
import path from 'path';
import { createNamespacedDebug } from './logger.js';
import { HTTP, MESSAGES, DEFAULTS } from './constants.js';
import { modifyHtml } from './utils.js';
import { getClientPublicPath } from './client-path.js';
const debug = createNamespacedDebug('connectionHandler');
async function sendClient(filePath, config, res) {
    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath from trusted client module
        const data = await fs.readFile(filePath, 'utf8');
        const modifiedHtml = modifyHtml(data, config);
        res.send(modifiedHtml);
    }
    catch {
        res.status(HTTP.INTERNAL_SERVER_ERROR).send(MESSAGES.CLIENT_FILE_ERROR);
    }
}
export default async function handleConnection(req, res, _opts) {
    debug('Handling connection req.path:', req.path);
    const clientPath = getClientPublicPath();
    const tempConfig = {
        socket: {
            url: `${req.protocol}://${req.get('host')}`,
            path: '/ssh/socket.io',
        },
        autoConnect: req.path?.startsWith('/host/'),
    };
    const s = (req.session || {});
    if (s.usedBasicAuth && s.sshCredentials) {
        tempConfig['ssh'] = {
            host: s.sshCredentials.host,
            port: s.sshCredentials.port,
            ...(s.sshCredentials.term && { sshterm: s.sshCredentials.term }),
        };
        tempConfig['autoConnect'] = true;
        const sshCfg = tempConfig['ssh'];
        debug('Session-only auth enabled - credentials remain server-side: %O', {
            host: sshCfg?.host,
            port: sshCfg?.port,
            term: sshCfg?.sshterm,
            sessionId: req.sessionID,
            hasCredentials: true,
        });
    }
    const filePath = path.join(clientPath, DEFAULTS.CLIENT_FILE);
    await sendClient(filePath, tempConfig, res);
}
