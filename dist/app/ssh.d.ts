export default SSHConnection;
/**
 * SSHConnection class handles SSH connections and operations.
 * @extends EventEmitter
 */
declare class SSHConnection extends EventEmitter<[never]> {
    constructor(config: any);
    config: any;
    conn: SSH | null;
    stream: import("ssh2").ClientChannel | null;
    creds: Object | null;
    /**
     * Validates the format of a private key, supporting modern SSH key formats
     * @param {string} key - The private key string to validate
     * @returns {boolean} - Whether the key appears to be valid
     */
    validatePrivateKey(key: string): boolean;
    /**
     * Checks if a private key is encrypted
     * @param {string} key - The private key to check
     * @returns {boolean} - Whether the key is encrypted
     */
    isEncryptedKey(key: string): boolean;
    /**
     * Attempts to connect using the provided credentials
     * @param {Object} creds - The credentials object
     * @returns {Promise<Object>} - A promise that resolves with the SSH connection
     */
    connect(creds: Object): Promise<Object>;
    /**
     * Sets up SSH connection event handlers
     * @param {Function} resolve - Promise resolve function
     * @param {Function} reject - Promise reject function
     */
    setupConnectionHandlers(resolve: Function, reject: Function): void;
    /**
     * Handles keyboard-interactive authentication prompts.
     * @param {string} name - The name of the authentication request.
     * @param {string} instructions - The instructions for the keyboard-interactive prompt.
     * @param {string} lang - The language of the prompt.
     * @param {Array<Object>} prompts - The list of prompts provided by the server.
     * @param {Function} finish - The callback to complete the keyboard-interactive authentication.
     */
    handleKeyboardInteractive(name: string, instructions: string, lang: string, prompts: Array<Object>, finish: Function): void;
    /**
     * Sends prompts to the client for keyboard-interactive authentication.
     *
     * @param {string} name - The name of the authentication method.
     * @param {string} instructions - The instructions for the authentication.
     * @param {Array<{ prompt: string, echo: boolean }>} prompts - The prompts to be sent to the client.
     * @param {Function} finish - The callback function to be called when the client responds.
     */
    sendPromptsToClient(name: string, instructions: string, prompts: Array<{
        prompt: string;
        echo: boolean;
    }>, finish: Function): void;
    /**
     * Generates the SSH configuration object based on credentials.
     * @param {Object} creds - The credentials object
     * @param {boolean} useKey - Whether to attempt key authentication
     * @returns {Object} - The SSH configuration object
     */
    getSSHConfig(creds: Object, useKey: boolean): Object;
    /**
     * Opens an interactive shell session over the SSH connection.
     * @param {Object} options - Options for the shell
     * @param {Object} [envVars] - Environment variables to set
     * @returns {Promise<Object>} - A promise that resolves with the SSH shell stream
     */
    shell(options: Object, envVars?: Object): Promise<Object>;
    /**
     * Executes a single non-interactive command over the SSH connection.
     * Optionally requests a PTY when options.pty is true to emulate TTY behavior.
     *
     * @param {string} command - The command to execute
     * @param {Object} [options] - Execution options
     * @param {boolean} [options.pty] - Request a PTY for the exec channel
     * @param {string} [options.term] - Terminal type
     * @param {number} [options.rows] - Rows for PTY
     * @param {number} [options.cols] - Columns for PTY
     * @param {number} [options.width] - Pixel width for PTY
     * @param {number} [options.height] - Pixel height for PTY
     * @param {Object} [envVars] - Environment variables to set for the command
     * @returns {Promise<Object>} - Resolves with the SSH exec stream
     */
    exec(command: string, options?: {
        pty?: boolean | undefined;
        term?: string | undefined;
        rows?: number | undefined;
        cols?: number | undefined;
        width?: number | undefined;
        height?: number | undefined;
    }, envVars?: Object): Promise<Object>;
    /**
     * Resizes the terminal window for the current SSH session.
     * @param {number} rows - The number of rows for the terminal.
     * @param {number} cols - The number of columns for the terminal.
     */
    resizeTerminal(rows: number, cols: number): void;
    /**
     * Ends the SSH connection and stream.
     */
    end(): void;
    /**
     * Gets the environment variables for the SSH session
     * @param {Object} envVars - Environment variables from URL
     * @returns {Object} - Combined environment variables
     */
    getEnvironment(envVars: Object): Object;
}
import { EventEmitter } from 'events';
import { Client as SSH } from 'ssh2';
