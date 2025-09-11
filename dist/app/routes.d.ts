/**
 * @param {any} source
 * @param {any} session
 */
export function processHeaderParameters(source: any, session: any): void;
/**
 * @param {any} source
 * @param {any} session
 */
export function processEnvironmentVariables(source: any, session: any): void;
/**
 * @param {any} session
 * @param {{ host: any, port: any, username?: any, password?: any, term?: any }} param1
 */
export function setupSshCredentials(session: any, { host, port, username, password, term }: {
    host: any;
    port: any;
    username?: any;
    password?: any;
    term?: any;
}): unknown;
/**
 * @param {any} body
 * @param {any} session
 */
export function processSessionRecordingParams(body: any, session: any): void;
/**
 * @param {Error} err
 * @param {{ status: (code:number)=>{ send: (body:any)=>void, json: (b:any)=>void } }} res
 */
export function handleRouteError(err: Error, res: {
    status: (code: number) => {
        send: (body: any) => void;
        json: (b: any) => void;
    };
}): void;
/**
 * @param {import('./types/config').Config} config
 */
export function createRoutes(config: any): import("express-serve-static-core").Router;
