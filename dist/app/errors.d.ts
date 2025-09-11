export declare class WebSSH2Error extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare class ConfigError extends WebSSH2Error {
    constructor(message: string);
}
export declare class SSHConnectionError extends WebSSH2Error {
    constructor(message: string);
}
type ResponseLike = {
    status: (code: number) => {
        json: (body: unknown) => void;
    };
};
export declare function handleError(err: Error, res?: ResponseLike): void;
export {};
