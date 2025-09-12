// server
// app/routes.ts
import express, {} from 'express';
import { getValidatedHost, getValidatedPort, maskSensitiveData, validateSshTerm, parseEnvVars, } from './utils.js';
import handleConnection from './connectionHandler.js';
import { createNamespacedDebug } from './logger.js';
import { createAuthMiddleware } from './middleware.js';
import { ConfigError, handleError } from './errors.js';
import { HTTP } from './constants.js';
const debug = createNamespacedDebug('routes');
export function processHeaderParameters(source, session) {
    const isGet = !!(Object.prototype.hasOwnProperty.call(source || {}, 'header') ||
        Object.prototype.hasOwnProperty.call(source || {}, 'headerBackground') ||
        Object.prototype.hasOwnProperty.call(source || {}, 'headerStyle'));
    let headerVal;
    let backgroundVal;
    let styleVal;
    if (isGet) {
        const { header, headerBackground, headerStyle } = (source || {});
        headerVal = header;
        backgroundVal = headerBackground;
        styleVal = headerStyle;
    }
    else if (source) {
        headerVal = source['header.name'];
        backgroundVal = source['header.background'];
        const colorVal = source['header.color'];
        styleVal = colorVal ? `color: ${colorVal}` : undefined;
    }
    if (headerVal || backgroundVal || styleVal) {
        session.headerOverride = session.headerOverride || {};
        if (headerVal) {
            session.headerOverride.text = headerVal;
            debug('Header text from %s: %s', isGet ? 'URL parameter' : 'POST', headerVal);
        }
        if (backgroundVal) {
            session.headerOverride.background = backgroundVal;
            debug('Header background from %s: %s', isGet ? 'URL parameter' : 'POST', backgroundVal);
        }
        if (styleVal) {
            session.headerOverride.style = styleVal;
            debug('Header style from %s: %s', isGet ? 'URL parameter' : 'POST', styleVal);
        }
        debug('Header override set in session: %O', session.headerOverride);
    }
}
export function processEnvironmentVariables(source, session) {
    const envVars = parseEnvVars(source?.['env']);
    if (envVars) {
        ;
        session['envVars'] = envVars;
        debug('routes: Parsed environment variables: %O', envVars);
    }
}
export function setupSshCredentials(session, opts) {
    session.sshCredentials = session.sshCredentials || {};
    session.sshCredentials.host = opts.host;
    session.sshCredentials.port = opts.port;
    if (opts.username) {
        session.sshCredentials.username = opts.username;
    }
    if (opts.password) {
        session.sshCredentials.password = opts.password;
    }
    if (opts.term) {
        session.sshCredentials.term = opts.term;
    }
    session.usedBasicAuth = true;
    const sanitized = maskSensitiveData(JSON.parse(JSON.stringify(session['sshCredentials'])));
    return sanitized;
}
export function processSessionRecordingParams(body, session) {
    if (body['allowreplay'] === 'true' || body['allowreplay'] === true) {
        session.allowReplay = true;
    }
    if (body['mrhsession']) {
        session.mrhSession = body['mrhsession'];
    }
    if (body['readyTimeout']) {
        session.readyTimeout = parseInt(body['readyTimeout'], 10);
    }
}
export function handleRouteError(err, res) {
    const error = new ConfigError(`Invalid configuration: ${err.message}`);
    handleError(error, res);
}
function handlePostAuthentication(req, res, hostParam, config) {
    try {
        const username = req.body['username'] ||
            req.headers['x-apm-username'];
        const password = req.body['password'] ||
            req.headers['x-apm-password'];
        if (!username || !password) {
            return void res.status(HTTP.UNAUTHORIZED).send('Username and password required');
        }
        let host;
        if (hostParam) {
            host = getValidatedHost(hostParam);
        }
        else {
            if (!config.ssh.host) {
                throw new ConfigError('Host parameter required when default host not configured');
            }
            host = req.body['host'] || config.ssh.host;
        }
        const port = getValidatedPort(req.body['port']);
        const sshterm = validateSshTerm(req.body['sshterm']);
        processHeaderParameters(req.body, req.session);
        processEnvironmentVariables(req.body, req.session);
        const sanitizedCredentials = setupSshCredentials(req.session, {
            host,
            port,
            username,
            password,
            term: sshterm,
        });
        req.session.authMethod = 'POST';
        const routePath = hostParam ? `/ssh/host/:host POST` : `/ssh/host/ POST`;
        debug(`${routePath} Credentials: `, sanitizedCredentials);
        processSessionRecordingParams(req.body, req.session);
        handleConnection(req, res, { host });
    }
    catch (err) {
        handleRouteError(err, res);
    }
}
export function createRoutes(config) {
    const router = express.Router();
    const auth = createAuthMiddleware(config);
    router.get('/', (req, res) => {
        const r = req;
        debug('router.get./: Accessed / route');
        processHeaderParameters(r.query, r.session);
        handleConnection(req, res);
    });
    router.get('/host/', auth, (req, res) => {
        const r = req;
        debug(`router.get.host: /ssh/host/ route`);
        processEnvironmentVariables(r.query, r.session);
        processHeaderParameters(r.query, r.session);
        try {
            if (!config.ssh.host) {
                throw new ConfigError('Host parameter required when default host not configured');
            }
            const { host } = config.ssh;
            const port = getValidatedPort(r.query['port']);
            const sshterm = validateSshTerm(r.query['sshterm']);
            const sanitizedCredentials = setupSshCredentials(r.session, {
                host,
                port,
                term: (r.query['sshterm'] ? sshterm : null) ?? null,
            });
            debug('/ssh/host/ Credentials: ', sanitizedCredentials);
            handleConnection(req, res, { host });
        }
        catch (err) {
            handleRouteError(err, res);
        }
    });
    router.get('/host/:host', auth, (req, res) => {
        const r = req;
        debug(`router.get.host: /ssh/host/${String(req.params['host'])} route`);
        processEnvironmentVariables(r.query, r.session);
        processHeaderParameters(r.query, r.session);
        try {
            const host = getValidatedHost(r.params['host']);
            const port = getValidatedPort(r.query['port']);
            const sshterm = validateSshTerm(r.query['sshterm']);
            const sanitizedCredentials = setupSshCredentials(r.session, {
                host,
                port,
                term: (r.query['sshterm'] ? sshterm : null) ?? null,
            });
            debug('/ssh/host/ Credentials: ', sanitizedCredentials);
            handleConnection(req, res, { host });
        }
        catch (err) {
            handleRouteError(err, res);
        }
    });
    router.post('/host/', (req, res) => {
        const r = req;
        debug(`router.post.host: /ssh/host/ route`);
        handlePostAuthentication(r, res, null, config);
    });
    router.post('/host/:host', (req, res) => {
        const r = req;
        debug(`router.post.host: /ssh/host/${String(req.params['host'])} route`);
        handlePostAuthentication(r, res, r.params['host'], config);
    });
    router.get('/clear-credentials', (req, res) => {
        const r = req;
        delete r.session['sshCredentials'];
        res.status(HTTP.OK).send(HTTP.CREDENTIALS_CLEARED);
    });
    router.get('/force-reconnect', (req, res) => {
        const r = req;
        delete r.session['sshCredentials'];
        res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED);
    });
    return router;
}
