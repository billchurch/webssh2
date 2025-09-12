import session from 'express-session';
import bodyParser from 'body-parser';
import basicAuth from 'basic-auth';
import validator from 'validator';
import { HTTP } from './constants.js';
import { createSecurityHeadersMiddleware } from './security-headers.js';
const { urlencoded, json } = bodyParser;
export function createAuthMiddleware(config) {
    return (req, res, next) => {
        const r = req;
        // Config-supplied credentials take precedence
        if (config.user.name && (config.user.password || config.user.privateKey)) {
            r.session = r.session || {};
            const creds = { username: config.user.name };
            if (config.user.privateKey) {
                creds['privateKey'] = config.user.privateKey;
            }
            if (config.user.password) {
                creds['password'] = config.user.password;
            }
            r.session['sshCredentials'] = creds;
            r.session['usedBasicAuth'] = true;
            return next();
        }
        const credentials = basicAuth(req);
        if (!credentials) {
            res.setHeader(HTTP.AUTHENTICATE, HTTP.REALM);
            return res.status(HTTP.UNAUTHORIZED).send(HTTP.AUTH_REQUIRED);
        }
        r.session = r.session || {};
        r.session['sshCredentials'] = {
            username: validator.escape(credentials.name ?? ''),
            password: credentials.pass,
        };
        r.session['usedBasicAuth'] = true;
        next();
    };
}
export function createSessionMiddleware(config) {
    return session({
        secret: config.session.secret,
        resave: false,
        saveUninitialized: true,
        name: config.session.name,
    });
}
export function createBodyParserMiddleware() {
    return [urlencoded({ extended: true }), json()];
}
export function createCookieMiddleware() {
    return (req, res, next) => {
        const r = req;
        const s = r.session;
        if (s?.['sshCredentials']) {
            const cookieData = {
                host: s['sshCredentials'].host,
                port: s['sshCredentials'].port,
            };
            res.cookie(HTTP.COOKIE, JSON.stringify(cookieData), {
                httpOnly: false,
                path: HTTP.PATH,
                sameSite: HTTP.SAMESITE.toLowerCase(),
            });
        }
        next();
    };
}
export function createSSOAuthMiddleware(config) {
    return (req, _res, next) => {
        if (req.method !== 'POST') {
            return next();
        }
        if (req.headers['x-apm-username'] && req.headers['x-apm-password']) {
            return next();
        }
        const body = req.body;
        if (body?.username && body?.password) {
            return next();
        }
        if (config.sso?.enabled && config.user?.name && config.user?.password) {
            const r = req;
            r.body = r.body || {};
            r.body.username = r.body.username ?? config.user.name;
            r.body.password = r.body.password ?? config.user.password;
            return next();
        }
        next();
    };
}
export function createCSRFMiddleware(config) {
    return (req, res, next) => {
        if (!config.sso?.csrfProtection) {
            return next();
        }
        if ((config.sso?.trustedProxies?.length ?? 0) > 0) {
            const clientIp = (req.ip || req.connection?.remoteAddress);
            if (clientIp && config.sso.trustedProxies.includes(clientIp)) {
                return next();
            }
        }
        if (req.headers['x-apm-username'] || req.headers['x-apm-session']) {
            return next();
        }
        if (req.method === 'POST') {
            const r = req;
            const token = r.body?._csrf || req.headers['x-csrf-token'];
            const sessionToken = r.session?.['csrfToken'];
            if (!sessionToken || token !== sessionToken) {
                return res.status(HTTP.FORBIDDEN).send('CSRF token validation failed');
            }
        }
        next();
    };
}
export function applyMiddleware(app, config) {
    app.use(createSecurityHeadersMiddleware(config));
    const sessionMiddleware = createSessionMiddleware(config);
    app.use(sessionMiddleware);
    app.use(createBodyParserMiddleware());
    if (config.sso?.enabled) {
        app.use(createCSRFMiddleware(config));
        app.use(createSSOAuthMiddleware(config));
    }
    app.use(createCookieMiddleware());
    return { sessionMiddleware };
}
