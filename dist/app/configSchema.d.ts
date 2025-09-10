/**
 * Configuration structure interface
 */
export interface Config {
    listen: {
        ip: string;
        port: number;
    };
    http: {
        origins: string[];
    };
    user: {
        name: string | null;
        password: string | null;
        privateKey?: string | null;
        passphrase?: string | null;
    };
    ssh: {
        host: string | null;
        port: number;
        term: string;
        readyTimeout: number;
        keepaliveInterval: number;
        keepaliveCountMax: number;
        algorithms?: {
            kex: string[];
            cipher: string[];
            hmac: string[];
            serverHostKey: string[];
            compress: string[];
        };
    };
    header: {
        text: string | null;
        background: string;
    };
    options: {
        challengeButton: boolean;
        autoLog?: boolean;
        allowReauth: boolean;
        allowReconnect?: boolean;
        allowReplay: boolean;
    };
    session?: {
        secret: string;
        name: string;
    };
}
/**
 * Schema for validating the config
 */
declare const configSchema: {
    readonly type: "object";
    readonly properties: {
        readonly listen: {
            readonly type: "object";
            readonly properties: {
                readonly ip: {
                    readonly type: "string";
                    readonly format: "ipv4";
                };
                readonly port: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly maximum: 65535;
                };
            };
            readonly required: readonly ["ip", "port"];
        };
        readonly http: {
            readonly type: "object";
            readonly properties: {
                readonly origins: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                };
            };
            readonly required: readonly ["origins"];
        };
        readonly user: {
            readonly type: "object";
            readonly properties: {
                readonly name: {
                    readonly type: readonly ["string", "null"];
                };
                readonly password: {
                    readonly type: readonly ["string", "null"];
                };
                readonly privateKey: {
                    readonly type: readonly ["string", "null"];
                };
                readonly passphrase: {
                    readonly type: readonly ["string", "null"];
                };
            };
            readonly required: readonly ["name", "password"];
        };
        readonly ssh: {
            readonly type: "object";
            readonly properties: {
                readonly host: {
                    readonly type: readonly ["string", "null"];
                };
                readonly port: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly maximum: 65535;
                };
                readonly term: {
                    readonly type: "string";
                };
                readonly readyTimeout: {
                    readonly type: "integer";
                };
                readonly keepaliveInterval: {
                    readonly type: "integer";
                };
                readonly keepaliveCountMax: {
                    readonly type: "integer";
                };
                readonly algorithms: {
                    readonly type: "object";
                    readonly properties: {
                        readonly kex: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "string";
                            };
                        };
                        readonly cipher: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "string";
                            };
                        };
                        readonly hmac: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "string";
                            };
                        };
                        readonly serverHostKey: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "string";
                            };
                        };
                        readonly compress: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "string";
                            };
                        };
                    };
                    readonly required: readonly ["kex", "cipher", "hmac", "serverHostKey", "compress"];
                };
            };
            readonly required: readonly ["host", "port", "term", "readyTimeout", "keepaliveInterval", "keepaliveCountMax"];
        };
        readonly header: {
            readonly type: "object";
            readonly properties: {
                readonly text: {
                    readonly type: readonly ["string", "null"];
                };
                readonly background: {
                    readonly type: "string";
                };
            };
            readonly required: readonly ["text", "background"];
        };
        readonly options: {
            readonly type: "object";
            readonly properties: {
                readonly challengeButton: {
                    readonly type: "boolean";
                };
                readonly autoLog: {
                    readonly type: "boolean";
                };
                readonly allowReauth: {
                    readonly type: "boolean";
                };
                readonly allowReconnect: {
                    readonly type: "boolean";
                };
                readonly allowReplay: {
                    readonly type: "boolean";
                };
            };
            readonly required: readonly ["challengeButton", "allowReauth", "allowReplay"];
        };
    };
    readonly required: readonly ["listen", "http", "user", "ssh", "header", "options"];
};
export default configSchema;
//# sourceMappingURL=configSchema.d.ts.map