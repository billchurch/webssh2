/**
 * Centralized test constants for all test files
 * This file contains all test credentials, passwords, and secrets
 * to avoid SonarQube S2068 violations spread across multiple files
 * 
 * SonarQube exclusion: This file is excluded from SonarQube analysis
 * in sonar-project.properties
 */

// ============================================================================
// CREDENTIALS & AUTHENTICATION
// ============================================================================

// Basic test credentials
export const TEST_USERNAME = 'testuser'
export const TEST_PASSWORD = 'testpass' //NOSONAR
export const TEST_PASSWORD_ALT = 'testpassword' //NOSONAR
export const INVALID_USERNAME = 'wronguser'
export const INVALID_PASSWORD = 'wrongpass' //NOSONAR

// Additional test usernames
export const CONFIG_USERNAME = 'configuser'
export const BASIC_USERNAME = 'basicuser'
export const SSH_USERNAME = 'sshuser'

// Various test passwords used in different contexts
export const TEST_PASSWORDS = {
  basic: 'pass', //NOSONAR
  basic123: 'pass123', //NOSONAR
  session: 'session-password', //NOSONAR
  state: 'state-password', //NOSONAR
  test: 'test-password', //NOSONAR
  secret: 'secret', //NOSONAR
  secret123: 'secret123', //NOSONAR
  adminPass: 'admin-pass', //NOSONAR
  configPass: 'configpass', //NOSONAR
  basicPass: 'basicpass', //NOSONAR
} as const

// Session and secrets
// Note: Business rules now require 32+ character secrets for security
export const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long' //NOSONAR
export const TEST_SECRET_KEY = 'test-secret-key' //NOSONAR
export const TEST_SECRET_LONG = 'test-secret-key-12345-extended-to-32-characters' //NOSONAR
export const TEST_SECRET_123 = 'test-secret-123-that-is-at-least-32-characters' //NOSONAR
export const MY_SECRET = 'mysecret' //NOSONAR
export const MY_SESSION_SECRET = 'my-session-secret-extended-to-meet-32-char-min' //NOSONAR
export const TEST_SESSION_SECRET = 'test-session-secret-extended-for-32-char-minimum' //NOSONAR
export const TEST_MINIMAL_SECRET = 's' //NOSONAR
export const TEST_SECRET_SHORT = 'test-secret' //NOSONAR - Intentionally short for validation tests

// Keys and passphrases
export const TEST_PRIVATE_KEY = 'test-key' //NOSONAR
export const TEST_PASSPHRASE = 'test-passphrase' //NOSONAR
export const TEST_SSH_KEY = 'ssh-rsa-key' //NOSONAR
export const TEST_SSH_PRIVATE_KEY_VALID = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----' //NOSONAR
export const TEST_SSH_PRIVATE_KEY_INVALID = 'not-a-valid-private-key-format' //NOSONAR

// Private key test data for validation tests
export const TEST_KEY_OPENSSH = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
-----END OPENSSH PRIVATE KEY-----` //NOSONAR

export const TEST_KEY_RSA = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF0qnMDvtaE68iS8RwZTyT8TsLHYr
-----END RSA PRIVATE KEY-----` //NOSONAR

export const TEST_KEY_EC = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIIGLlamZU9Z83D3g8VsZqsMpLMgCuRXmZrdWpBfxHdaPoAoGCCqGSM49
-----END EC PRIVATE KEY-----` //NOSONAR

export const TEST_KEY_ENCRYPTED_RSA = `-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-128-CBC,2AF25325A9B286F4CBD8AB0C4C3CDB3A` //NOSONAR

export const TEST_KEY_ENCRYPTED_PKCS8 = `-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIFLTBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQITo1O0b8YrS0CAggA` //NOSONAR

export const TEST_KEY_ENCRYPTED_OPENSSH = `-----BEGIN OPENSSH PRIVATE KEY-----
aes256-ctr
bcrypt
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABBB
-----END OPENSSH PRIVATE KEY-----` //NOSONAR

export const TEST_KEY_PLAIN = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF0qnMDvtaE68iS8RwZTyT8TsLHYr` //NOSONAR

// ============================================================================
// SSH CONFIGURATION
// ============================================================================

// Terminal configuration (defined early so TEST_SSH can reference it)
export const TERMINAL = {
  TYPE: 'xterm-256color',
  DEFAULT_ROWS: 24,
  DEFAULT_COLS: 80,
  TEST_ROWS: 50,
  TEST_COLS: 120,
  LARGE_COLS: 120,
  LARGE_ROWS: 40,
  MEDIUM_COLS: 100,
  MEDIUM_ROWS: 30,
  INPUT_SELECTOR: 'textbox',
  INPUT_NAME: 'Terminal input',
} as const

interface TestSSHConstants {
  readonly USERNAME: string
  readonly PASSWORD: string
  readonly HOST: string
  readonly IP_ADDRESS: string
  readonly PORT: number
  readonly PRIVATE_KEY: string
  readonly PASSPHRASE: string
  readonly TERMINAL: {
    readonly TYPE: string
    readonly DEFAULT_COLS: number
    readonly DEFAULT_ROWS: number
    readonly LARGE_COLS: number
    readonly LARGE_ROWS: number
    readonly MEDIUM_COLS: number
    readonly MEDIUM_ROWS: number
  }
  readonly COMMANDS: {
    readonly LIST_FILES: string
    readonly ECHO_TEST: string
  }
  readonly ENV_VARS: {
    readonly PATH: string
    readonly USER: string
  }
  readonly TIMEOUT_MS: number
  readonly INVALID_VALUES: {
    readonly PORT_NEGATIVE: number
    readonly PORT_TOO_HIGH: number
    readonly COLS_TOO_HIGH: number
    readonly ROWS_TOO_LOW: number
    readonly STRING_PORT: unknown
  }
}

export const TEST_SSH: TestSSHConstants = {
  USERNAME: TEST_USERNAME,
  PASSWORD: TEST_PASSWORD, //NOSONAR
  HOST: 'example.com',
  IP_ADDRESS: '192.168.1.100', //NOSONAR
  PORT: 22,
  PRIVATE_KEY: 'ssh-rsa...',
  PASSPHRASE: 'keypass', //NOSONAR
  TERMINAL: {
    TYPE: TERMINAL.TYPE,
    DEFAULT_COLS: TERMINAL.DEFAULT_COLS,
    DEFAULT_ROWS: TERMINAL.DEFAULT_ROWS,
    LARGE_COLS: TERMINAL.LARGE_COLS,
    LARGE_ROWS: TERMINAL.LARGE_ROWS,
    MEDIUM_COLS: TERMINAL.MEDIUM_COLS,
    MEDIUM_ROWS: TERMINAL.MEDIUM_ROWS
  },
  COMMANDS: {
    LIST_FILES: 'ls -la',
    ECHO_TEST: 'echo test'
  },
  ENV_VARS: {
    PATH: '/usr/bin',
    USER: TEST_USERNAME
  },
  TIMEOUT_MS: 5000,
  INVALID_VALUES: {
    PORT_NEGATIVE: -1,
    PORT_TOO_HIGH: 70000,
    COLS_TOO_HIGH: 10000,
    ROWS_TOO_LOW: 0,
    STRING_PORT: 'invalid' as unknown
  }
} as const

export const TEST_NETWORK = {
  LOOPBACK_IP: '127.0.0.1', //NOSONAR
  CLIENT_CONTEXT_IP: '198.51.100.1', //NOSONAR
  FORWARDED_IP: '203.0.113.5', //NOSONAR
  HANDSHAKE_IP: '203.0.113.10', //NOSONAR
  SSH_TARGET_IP: '192.168.1.19', //NOSONAR
  FORWARDED_PORT: 51234
} as const

export const TEST_USER_AGENTS = {
  DEFAULT: 'TestAgent/1.0', //NOSONAR
  BLOCKED: 'BlockedAgent/2.0', //NOSONAR
  NO_PASSWORD: 'NoPasswordAgent/3.0', //NOSONAR
  WRITE_FAIL: 'WriteFail/4.0', //NOSONAR
  SERVICE_SOCKET: 'TestAgent/5.0' //NOSONAR
} as const

export const TEST_SOCKET_CONSTANTS = {
  REMOTE_PASSWORD_HEADER: 'x-remote-pass', //NOSONAR
  SESSION_CREDENTIALS_KEY: 'session_credentials', //NOSONAR
  PASSWORD_SOURCE_NONE: 'none', //NOSONAR
  SSO_PASSWORD_HEADER: 'x-pass', //NOSONAR
  TARGET_HOST: '10.0.0.5' //NOSONAR
} as const

// SSH test credentials objects
export const SSH_TEST_CREDENTIALS = {
  host: 'localhost',
  port: 22,
  username: TEST_USERNAME,
  password: TEST_PASSWORD, //NOSONAR
} as const

export const SSH_INVALID_CREDENTIALS = {
  host: 'localhost',
  port: 22,
  username: TEST_USERNAME,
  password: INVALID_PASSWORD, //NOSONAR
} as const

// ============================================================================
// MOCK DATA & TEST SCENARIOS
// ============================================================================

// Test credentials objects for different scenarios
export const MOCK_CREDENTIALS = {
  basic: {
    host: 'h',
    port: 22,
    username: 'u',
    password: 'p', //NOSONAR
  },
  full: {
    host: TEST_SSH.HOST,
    port: 22,
    username: 'user',
    password: TEST_PASSWORDS.basic,
  },
  withSession: {
    host: TEST_SSH.HOST,
    username: 'user',
    password: TEST_PASSWORDS.session,
  },
} as const

// Form data for testing
export const TEST_FORM_DATA = {
  basic: `username=${TEST_USERNAME}&password=${TEST_PASSWORD}`,
} as const

// Environment variable test values
export const ENV_TEST_VALUES = {
  secret: '%TEST_SECRET_THAT_IS_AT_LEAST_32_CHARACTERS_LONG%',
} as const

// ============================================================================
// SSO & HEADERS
// ============================================================================

// SSO header names (not actual passwords, but often flagged)
export const SSO_HEADERS = {
  username: 'x-apm-username',
  password: 'x-apm-password', //NOSONAR
  session: 'x-apm-session',
  // Standard header names
  USERNAME: 'x-username',
  PASSWORD: 'x-password', //NOSONAR
  SESSION: 'x-session'
} as const

// Alternative SSO header names for testing
export const SSO_AUTH_HEADERS = {
  username: 'x-auth-user',
  password: 'x-auth-pass', //NOSONAR
  session: 'x-auth-session',
} as const

// SSO test values
export const SSO_TEST_VALUES = {
  username: 'apmuser',
  password: 'apmpass', //NOSONAR
} as const


// ============================================================================
// NETWORK & PORTS
// ============================================================================

// Network and subnet constants for testing
export const TEST_SUBNETS = {
  // IPv4 subnets
  PRIVATE_10: '10.0.0.0/8', //NOSONAR
  PRIVATE_10_24: '10.0.0.0/24', //NOSONAR
  PRIVATE_172: '172.16.0.0/12', //NOSONAR
  PRIVATE_192: '192.168.1.0/24', //NOSONAR
  PRIVATE_192_16: '192.168.0.0/16', //NOSONAR
  LOCALHOST: '127.0.0.0/8',
  ANY: '0.0.0.0/0',
  // IPv6 subnets
  LOCALHOST_V6: '::1/128',
  LINK_LOCAL_V6: 'fe80::/10', //NOSONAR
  UNIQUE_LOCAL_V6: 'fc00::/7', //NOSONAR
  DOCUMENTATION_V6: '2001:db8::/32', //NOSONAR
  DOCUMENTATION_V6_64: '2001:db8::/64', //NOSONAR
  ANY_V6: '::/0' //NOSONAR
} as const

export const TEST_IPS = {
  // IPv4 addresses
  ANY: '0.0.0.0', //NOSONAR
  LOCALHOST: '127.0.0.1', //NOSONAR
  PRIVATE_10: '10.0.0.1', //NOSONAR
  PRIVATE_10_ALT: '10.255.255.254', //NOSONAR
  PRIVATE_172: '172.16.0.1', //NOSONAR
  PRIVATE_192: '192.168.1.1', //NOSONAR
  PRIVATE_192_100: '192.168.1.100', //NOSONAR
  PRIVATE_192_101: '192.168.1.101', //NOSONAR
  PRIVATE_192_254: '192.168.1.254', //NOSONAR
  PRIVATE_192_2_1: '192.168.2.1', //NOSONAR
  PRIVATE_192_2_100: '192.168.2.100', //NOSONAR
  PRIVATE_192_255_254: '192.168.255.254', //NOSONAR
  PRIVATE_169_1_1: '192.169.1.1', //NOSONAR
  PRIVATE_10_0_50: '10.0.0.50', //NOSONAR
  PRIVATE_10_0_255_254: '10.0.255.254', //NOSONAR
  PRIVATE_10_1_0_1: '10.1.0.1', //NOSONAR
  PRIVATE_11_0_0_1: '11.0.0.1', //NOSONAR
  LOCALHOST_100: '127.0.0.100', //NOSONAR
  PUBLIC_DNS: '8.8.8.8', //NOSONAR
  NONROUTABLE: '240.0.0.0', //NOSONAR - Non-routable IP for timeout tests
  // IPv6 addresses
  LOCALHOST_V6: '::1', //NOSONAR
  LOCALHOST_V6_ALT: '::2', //NOSONAR
  DOCUMENTATION_V6: '2001:db8::1', //NOSONAR
  DOCUMENTATION_V6_ALT: '2001:db8::2', //NOSONAR
  DOCUMENTATION_V6_FFFF: '2001:db8::ffff', //NOSONAR
  DOCUMENTATION_V6_SUBNET: '2001:db8:1::1', //NOSONAR
  DOCUMENTATION_V6_SUBNET_ALT: '2001:db8:ffff::1', //NOSONAR
  DOCUMENTATION_V6_DIFF: '2001:db9::1' //NOSONAR
} as const

// Test wildcards for IPv4
export const TEST_WILDCARDS = {
  PRIVATE_192_ALL: '192.168.1.*', //NOSONAR
  PRIVATE_10_DOUBLE: '10.0.*.*', //NOSONAR
  PRIVATE_172_ALL: '172.16.*.*' //NOSONAR
} as const

// Test HTTP origins
export const TEST_HTTP_ORIGINS = {
  SINGLE: 'http://localhost:3000',
  MULTIPLE: 'http://localhost:3000,http://localhost:8080', //NOSONAR
  ARRAY: ['http://localhost:3000', 'http://localhost:8080']
} as const

// Common test ports
export const TEST_PORTS = {
  webssh2: 2288,
  sshServer: 2289,
  sshServerUnit: 2222,  // Unit test SSH server port
  alternateWebssh2: 2290,
  invalid: 9999,  // Non-existent port for failure tests
  // E2E test ports (different to avoid conflicts)
  e2eWeb: Number(process.env.E2E_WEB_PORT ?? 4444),
  e2eSsh: Number(process.env.E2E_SSH_PORT ?? 4422),
  clientDev: 3000
} as const

// ============================================================================
// TIMEOUTS
// ============================================================================

// Common test timeouts (in milliseconds)
export const TEST_TIMEOUTS = {
  short: 1000,
  medium: 5000,
  long: 10000,
  network: 15000,
  // E2E specific timeouts
  DEFAULT: 10000,
  NAVIGATION: 30000,
  CONNECTION: 5000,
  PROMPT_WAIT: 10000,
  SHORT_WAIT: 500,
  MEDIUM_WAIT: 2000,
  LONG_WAIT: 5000,
  ACTION: 15000,
  TEST_EXTENDED: 60000,
  DOCKER_WAIT: 20000,
  DOCKER_RETRY: 250,
  WEB_SERVER: 120000,
} as const

// ============================================================================
// CONTROL ACTIONS
// ============================================================================

interface ControlActionsConstants {
  readonly REAUTH: string
  readonly CLEAR_CREDENTIALS: string
  readonly DISCONNECT: string
}

// Control actions for socket messages
export const CONTROL_ACTIONS: ControlActionsConstants = {
  REAUTH: 'reauth',
  CLEAR_CREDENTIALS: 'clear-credentials',
  DISCONNECT: 'disconnect'
} as const

// ============================================================================
// DOCKER & E2E
// ============================================================================

// Container configuration for E2E tests
// Supports both Docker and Apple Container Runtime (command: container)
// The container runtime is auto-detected at test startup
export const DOCKER_CONFIG = {
  CONTAINER: 'webssh2-e2e-sshd',
  IMAGE: 'ghcr.io/billchurch/ssh_test:alpine',
} as const

// Invalid test values for negative testing
export const INVALID_TEST_VALUES = {
  USERNAME: 'invalid_user',
  PASSWORD: 'invalid_pass', //NOSONAR
  NON_EXISTENT_HOST: 'nonexistent.invalid.host',
  INVALID_PORT: '9999',
} as const

// ============================================================================
// ADDITIONAL TEST KEYS AND SECRETS
// ============================================================================

// Server and user private keys
export const TEST_SERVER_DEFAULT_KEY = 'server-default-key' //NOSONAR
export const TEST_USER_KEY = 'user-key' //NOSONAR
export const TEST_SERVER_KEY_CONTENT = 'server-key-content' //NOSONAR
export const TEST_USER_KEY_CONTENT = 'user-key-content' //NOSONAR

// Valid session secrets (32+ chars for security)
export const TEST_SESSION_SECRET_VALID = 'a'.repeat(32) //NOSONAR
export const TEST_SESSION_SECRET_SHORT = 'tooshort' //NOSONAR
export const TEST_SESSION_SECRET_SUPER = 'supersecret' //NOSONAR

// Additional test ports for custom configurations
export const TEST_CUSTOM_PORTS = {
  port1: 3333,
  port2: 5555,
  port3: 6666,
} as const

// ============================================================================
// SFTP TEST CONSTANTS
// ============================================================================

/**
 * SFTP test configuration constants
 */
export const SFTP_TEST_CONFIG = {
  /** Maximum file size for test uploads (10MB) */
  MAX_FILE_SIZE: 10_485_760,
  /** Chunk size for transfers */
  CHUNK_SIZE: 32_768,
  /** Extensions that should be blocked */
  BLOCKED_EXTENSIONS: ['.exe', '.dll', '.so'],
  /** Test directory name for SFTP operations */
  TEST_DIR_NAME: 'webssh2-sftp-test',
  /** Test file name for uploads */
  TEST_FILE_NAME: 'test-upload.txt',
  /** Test file content */
  TEST_FILE_CONTENT: 'Hello from WebSSH2 SFTP E2E test!\nThis is test content.',
  /** Blocked extension test file */
  BLOCKED_FILE_NAME: 'malicious.exe',
  /** Large file content (for chunked upload testing) */
  LARGE_FILE_SIZE: 100_000,
} as const

/**
 * SFTP socket event names for E2E tests
 */
export const SFTP_EVENTS = {
  // Client → Server
  LIST: 'sftp-list',
  STAT: 'sftp-stat',
  MKDIR: 'sftp-mkdir',
  DELETE: 'sftp-delete',
  UPLOAD_START: 'sftp-upload-start',
  UPLOAD_CHUNK: 'sftp-upload-chunk',
  UPLOAD_CANCEL: 'sftp-upload-cancel',
  DOWNLOAD_START: 'sftp-download-start',
  DOWNLOAD_CANCEL: 'sftp-download-cancel',
  // Server → Client
  STATUS: 'sftp-status',
  DIRECTORY: 'sftp-directory',
  STAT_RESULT: 'sftp-stat-result',
  OPERATION_RESULT: 'sftp-operation-result',
  UPLOAD_READY: 'sftp-upload-ready',
  UPLOAD_ACK: 'sftp-upload-ack',
  DOWNLOAD_READY: 'sftp-download-ready',
  DOWNLOAD_CHUNK: 'sftp-download-chunk',
  PROGRESS: 'sftp-progress',
  COMPLETE: 'sftp-complete',
  ERROR: 'sftp-error',
} as const

/**
 * SFTP error codes for test assertions
 */
export const SFTP_ERROR_CODES = {
  NOT_ENABLED: 'SFTP_NOT_ENABLED',
  NO_CONNECTION: 'SFTP_NO_CONNECTION',
  SESSION_ERROR: 'SFTP_SESSION_ERROR',
  NOT_FOUND: 'SFTP_NOT_FOUND',
  PERMISSION_DENIED: 'SFTP_PERMISSION_DENIED',
  PATH_FORBIDDEN: 'SFTP_PATH_FORBIDDEN',
  EXTENSION_BLOCKED: 'SFTP_EXTENSION_BLOCKED',
  FILE_TOO_LARGE: 'SFTP_FILE_TOO_LARGE',
  ALREADY_EXISTS: 'SFTP_ALREADY_EXISTS',
  INVALID_REQUEST: 'SFTP_INVALID_REQUEST',
} as const

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TestCredentials = typeof SSH_TEST_CREDENTIALS
export type MockCredentials = typeof MOCK_CREDENTIALS
