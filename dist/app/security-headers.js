import createDebug from 'debug';
const debug = createDebug('webssh2:security');
export const CSP_CONFIG = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", 'ws:', 'wss:'],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", 'https:'],
    'upgrade-insecure-requests': [],
};
export function generateCSPHeader() {
    return Object.entries(CSP_CONFIG)
        .map(([directive, values]) => (values.length ? `${directive} ${values.join(' ')}` : directive))
        .join('; ');
}
export const SECURITY_HEADERS = {
    'Content-Security-Policy': generateCSPHeader(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
function generateCSPHeaderFromConfig(csp) {
    return Object.entries(csp)
        .map(([directive, values]) => (values.length ? `${directive} ${values.join(' ')}` : directive))
        .join('; ');
}
export function createSecurityHeadersMiddleware(config = {}) {
    return (req, res, next) => {
        const headers = { ...SECURITY_HEADERS };
        if (config.sso?.enabled && (config.sso?.trustedProxies?.length ?? 0) > 0) {
            const cspConfig = { ...CSP_CONFIG };
            const fa = cspConfig['form-action'];
            if (!fa.includes('https:')) {
                fa.push('https:');
            }
            headers['Content-Security-Policy'] = generateCSPHeaderFromConfig(cspConfig);
            debug('SSO mode: Adjusted CSP for trusted proxies');
        }
        for (const [header, value] of Object.entries(headers)) {
            if (header === 'Strict-Transport-Security' && !req.secure) {
                continue;
            }
            res.setHeader(header, value);
        }
        debug('Security headers applied to %s %s', req.method, req.url);
        next();
    };
}
export function createCSPMiddleware(customCSP = {}) {
    const merged = {
        ...CSP_CONFIG,
        ...customCSP,
    };
    const header = Object.entries(merged)
        .map(([d, v]) => (v && v.length ? `${d} ${v.join(' ')}` : d))
        .join('; ');
    return (req, res, next) => {
        res.setHeader('Content-Security-Policy', header);
        debug('Custom CSP applied to %s %s', req.method, req.url);
        next();
    };
}
