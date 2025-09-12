import { Client as SSH } from 'ssh2';
import { EventEmitter } from 'events';
import { createNamespacedDebug } from './logger.js';
import { SSHConnectionError } from './errors.js';
import { maskSensitiveData } from './utils.js';
const debug = createNamespacedDebug('ssh');
export default class SSHConnection extends EventEmitter {
    config;
    conn;
    stream;
    creds;
    constructor(config) {
        super();
        this.config = config;
        this.conn = null;
        this.stream = null;
        this.creds = null;
    }
    validatePrivateKey(key) {
        if (!key || typeof key !== 'string') {
            return false;
        }
        const trimmedKey = key.trim();
        const keyPatterns = [
            /^-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*-----END OPENSSH PRIVATE KEY-----$/,
            /^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*-----END (?:RSA )?PRIVATE KEY-----$/,
            /^-----BEGIN EC PRIVATE KEY-----[\s\S]*-----END EC PRIVATE KEY-----$/,
            /^-----BEGIN DSA PRIVATE KEY-----[\s\S]*-----END DSA PRIVATE KEY-----$/,
            /^-----BEGIN PRIVATE KEY-----[\s\S]*-----END PRIVATE KEY-----$/,
            /^-----BEGIN ENCRYPTED PRIVATE KEY-----[\s\S]*-----END ENCRYPTED PRIVATE KEY-----$/,
        ];
        return keyPatterns.some((pattern) => pattern.test(trimmedKey));
    }
    isEncryptedKey(key) {
        if (!key || typeof key !== 'string') {
            return false;
        }
        return (key.includes('Proc-Type: 4,ENCRYPTED') ||
            key.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----') ||
            (key.includes('-----BEGIN OPENSSH PRIVATE KEY-----') &&
                (key.includes('bcrypt') || key.includes('aes') || key.includes('3des'))));
    }
    connect(creds) {
        debug('connect: %O', maskSensitiveData(creds));
        this.creds = creds;
        if (this.conn) {
            this.conn.end();
        }
        this.conn = new SSH();
        const sshConfig = this.getSSHConfig(creds, true);
        debug('Initial connection config: %O', maskSensitiveData(sshConfig));
        return new Promise((resolve, reject) => {
            this.setupConnectionHandlers(resolve, reject);
            try {
                this.conn.connect(sshConfig);
            }
            catch (err) {
                reject(new SSHConnectionError(`Connection failed: ${err.message}`));
            }
        });
    }
    setupConnectionHandlers(resolve, reject) {
        this.conn.on('ready', () => {
            const host = String(this.creds?.['host'] ?? '');
            debug(`connect: ready: ${host}`);
            resolve(this.conn);
        });
        this.conn.on('error', (err) => {
            const e = err;
            const errorMessage = e.message || e.code || String(err) || 'Unknown error';
            reject(new SSHConnectionError(errorMessage));
        });
        this.conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts) => {
            this.emit('keyboard-interactive', { name, instructions, instructionsLang, prompts });
        });
    }
    shell(options, envVars) {
        const ptyOptions = {
            term: options.term,
            rows: options.rows,
            cols: options.cols,
            width: options.width,
            height: options.height,
        };
        const envOptions = envVars ? { ['env']: this.getEnvironment(envVars) } : undefined;
        debug(`shell: Creating shell with PTY options:`, ptyOptions, 'and env options:', envOptions);
        return new Promise((resolve, reject) => {
            this.conn.shell(ptyOptions, envOptions, (err, stream) => {
                if (err) {
                    reject(err);
                }
                else {
                    this.stream = stream;
                    resolve(stream);
                }
            });
        });
    }
    exec(command, options = {}, envVars) {
        const execOptions = {};
        if (envVars) {
            execOptions['env'] = this.getEnvironment(envVars);
        }
        if (options.pty) {
            execOptions['pty'] = {
                term: options.term,
                rows: options.rows,
                cols: options.cols,
                width: options.width,
                height: options.height,
            };
        }
        debug('exec: Executing command with options:', command, execOptions);
        return new Promise((resolve, reject) => {
            this.conn.exec(command, execOptions, (err, stream) => {
                if (err) {
                    reject(err);
                }
                else {
                    this.stream = stream;
                    resolve(stream);
                }
            });
        });
    }
    resizeTerminal(rows, cols) {
        if (this.stream && typeof this.stream.setWindow === 'function') {
            this.stream.setWindow(rows, cols);
        }
    }
    end() {
        if (this.stream) {
            this.stream.end && this.stream.end();
            this.stream = null;
        }
        if (this.conn) {
            this.conn.end();
            this.conn = null;
        }
    }
    getEnvironment(envVars) {
        const env = { TERM: this.config.ssh.term };
        if (envVars) {
            for (const k of Object.keys(envVars)) {
                env[k] = String(envVars[k]);
            }
        }
        return env;
    }
    getSSHConfig(creds, tryKeyboard) {
        const cfg = {
            host: String(creds['host'] ?? ''),
            port: Number(creds['port'] ?? 22),
            username: creds['username'] ?? undefined,
            tryKeyboard,
            algorithms: this.config.ssh.algorithms,
            readyTimeout: this.config.ssh.readyTimeout,
            keepaliveInterval: this.config.ssh.keepaliveInterval,
            keepaliveCountMax: this.config.ssh.keepaliveCountMax,
            debug: (msg) => debug(msg),
        };
        const privateKey = creds['privateKey'] ?? undefined;
        const passphrase = creds['passphrase'] ?? undefined;
        const password = creds['password'] ?? undefined;
        if (privateKey && this.validatePrivateKey(privateKey)) {
            cfg['privateKey'] = privateKey;
            if (this.isEncryptedKey(privateKey) && passphrase) {
                cfg['passphrase'] = passphrase;
            }
        }
        if (password) {
            cfg['password'] = password;
        }
        return cfg;
    }
}
