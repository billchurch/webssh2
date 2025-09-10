import { Client as SSH, type ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';
/**
 * SSH credentials interface
 */
export interface SSHCredentials {
    username: string;
    host: string;
    port?: number;
    password?: string;
    privateKey?: string;
    passphrase?: string;
}
/**
 * SSH configuration interface
 */
interface SSHConfig {
    ssh: {
        algorithms: {
            cipher: string[];
            compress: string[];
            hmac: string[];
            kex: string[];
            serverHostKey: string[];
        };
        readyTimeout: number;
        keepaliveInterval: number;
        keepaliveCountMax: number;
        term: string;
        alwaysSendKeyboardInteractivePrompts: boolean;
    };
    user: {
        privateKey?: string | null;
        passphrase?: string | null;
    };
}
/**
 * Shell/Exec options interface
 */
export interface TerminalOptions {
    term?: string;
    rows?: number;
    cols?: number;
    width?: number;
    height?: number;
    pty?: boolean;
}
/**
 * Keyboard interactive prompt interface
 */
interface KeyboardInteractivePrompt {
    prompt: string;
    echo: boolean;
}
/**
 * Keyboard interactive data interface
 */
interface KeyboardInteractiveData {
    name: string;
    instructions: string;
    prompts: KeyboardInteractivePrompt[];
}
/**
 * SSH Connection handler type
 */
type FinishCallback = (responses: string[]) => void;
/**
 * SSHConnection class handles SSH connections and operations.
 * @extends EventEmitter
 */
declare class SSHConnection extends EventEmitter {
    private config;
    private conn;
    private stream;
    private creds;
    constructor(config: SSHConfig);
    /**
     * Validates the format of a private key, supporting modern SSH key formats
     * @param key - The private key string to validate
     * @returns Whether the key appears to be valid
     */
    validatePrivateKey(key: string): boolean;
    /**
     * Checks if a private key is encrypted
     * @param key - The private key to check
     * @returns Whether the key is encrypted
     */
    isEncryptedKey(key: string): boolean;
    /**
     * Attempts to connect using the provided credentials
     * @param creds - The credentials object
     * @returns A promise that resolves with the SSH connection
     */
    connect(creds: SSHCredentials): Promise<SSH>;
    /**
     * Sets up SSH connection event handlers
     * @param resolve - Promise resolve function
     * @param reject - Promise reject function
     */
    private setupConnectionHandlers;
    /**
     * Handles keyboard-interactive authentication prompts.
     * @param name - The name of the authentication request.
     * @param instructions - The instructions for the keyboard-interactive prompt.
     * @param lang - The language of the prompt.
     * @param prompts - The list of prompts provided by the server.
     * @param finish - The callback to complete the keyboard-interactive authentication.
     */
    handleKeyboardInteractive(name: string, instructions: string, _lang: string, prompts: KeyboardInteractivePrompt[], finish: FinishCallback): void;
    /**
     * Sends prompts to the client for keyboard-interactive authentication.
     *
     * @param name - The name of the authentication method.
     * @param instructions - The instructions for the authentication.
     * @param prompts - The prompts to be sent to the client.
     * @param finish - The callback function to be called when the client responds.
     */
    sendPromptsToClient(name: string, instructions: string, prompts: KeyboardInteractivePrompt[], finish: FinishCallback): void;
    /**
     * Generates the SSH configuration object based on credentials.
     * @param creds - The credentials object
     * @param useKey - Whether to attempt key authentication
     * @returns The SSH configuration object
     */
    private getSSHConfig;
    /**
     * Opens an interactive shell session over the SSH connection.
     * @param options - Options for the shell
     * @param envVars - Environment variables to set
     * @returns A promise that resolves with the SSH shell stream
     */
    shell(options: TerminalOptions, envVars?: Record<string, string>): Promise<ClientChannel>;
    /**
     * Executes a single non-interactive command over the SSH connection.
     * Optionally requests a PTY when options.pty is true to emulate TTY behavior.
     *
     * @param command - The command to execute
     * @param options - Execution options
     * @param envVars - Environment variables to set for the command
     * @returns Resolves with the SSH exec stream
     */
    exec(command: string, options?: TerminalOptions, envVars?: Record<string, string>): Promise<ClientChannel>;
    /**
     * Resizes the terminal window for the current SSH session.
     * @param rows - The number of rows for the terminal.
     * @param cols - The number of columns for the terminal.
     */
    resizeTerminal(rows: number, cols: number): void;
    /**
     * Ends the SSH connection and stream.
     */
    end(): void;
    /**
     * Gets the environment variables for the SSH session
     * @param envVars - Environment variables from URL
     * @returns Combined environment variables
     */
    private getEnvironment;
}
export default SSHConnection;
export type { SSHConfig, KeyboardInteractivePrompt, KeyboardInteractiveData, FinishCallback };
//# sourceMappingURL=ssh.d.ts.map