// server
// app/errors.ts
import { logError, createNamespacedDebug } from './logger.js';
import { HTTP, MESSAGES } from './constants.js';
const debug = createNamespacedDebug('errors');
export class WebSSH2Error extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = new.target.name;
        this.code = code;
    }
}
export class ConfigError extends WebSSH2Error {
    constructor(message) {
        super(message, MESSAGES.CONFIG_ERROR);
    }
}
export class SSHConnectionError extends WebSSH2Error {
    constructor(message) {
        super(message, MESSAGES.SSH_CONNECTION_ERROR);
    }
}
export function handleError(err, res) {
    if (err instanceof WebSSH2Error) {
        logError(err.message, err);
        debug(err.message);
        if (res) {
            res.status(HTTP.INTERNAL_SERVER_ERROR).json({ error: err.message, code: err.code });
        }
    }
    else {
        logError(MESSAGES.UNEXPECTED_ERROR, err);
        debug(`handleError: ${MESSAGES.UNEXPECTED_ERROR}: %O`, err);
        if (res) {
            res.status(HTTP.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.UNEXPECTED_ERROR });
        }
    }
}
