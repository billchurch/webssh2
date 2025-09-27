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
export const TEST_SECRET = 'test-secret' //NOSONAR
export const TEST_SECRET_KEY = 'test-secret-key' //NOSONAR
export const TEST_SECRET_LONG = 'test-secret-key-12345' //NOSONAR
export const TEST_SECRET_123 = 'test-secret-123' //NOSONAR
export const MY_SECRET = 'mysecret' //NOSONAR
export const MY_SESSION_SECRET = 'my-session-secret' //NOSONAR
export const TEST_SESSION_SECRET = 'test-session-secret' //NOSONAR
export const TEST_MINIMAL_SECRET = 's' //NOSONAR

// Keys and passphrases
export const TEST_PRIVATE_KEY = 'test-key' //NOSONAR
export const TEST_PASSPHRASE = 'test-passphrase' //NOSONAR
export const TEST_SSH_KEY = 'ssh-rsa-key' //NOSONAR
export const TEST_SSH_PRIVATE_KEY_VALID = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----' //NOSONAR
export const TEST_SSH_PRIVATE_KEY_INVALID = 'not-a-valid-private-key-format' //NOSONAR

// ============================================================================
// SSH CONFIGURATION
// ============================================================================

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
  USERNAME: 'testuser',
  PASSWORD: 'testpass', //NOSONAR
  HOST: 'example.com',
  IP_ADDRESS: '192.168.1.100', //NOSONAR
  PORT: 22,
  PRIVATE_KEY: 'ssh-rsa...',
  PASSPHRASE: 'keypass', //NOSONAR
  TERMINAL: {
    TYPE: 'xterm-256color',
    DEFAULT_COLS: 80,
    DEFAULT_ROWS: 24,
    LARGE_COLS: 120,
    LARGE_ROWS: 40,
    MEDIUM_COLS: 100,
    MEDIUM_ROWS: 30
  },
  COMMANDS: {
    LIST_FILES: 'ls -la',
    ECHO_TEST: 'echo test'
  },
  ENV_VARS: {
    PATH: '/usr/bin',
    USER: 'testuser'
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
    host: 'example.com',
    port: 22,
    username: 'user',
    password: TEST_PASSWORDS.basic,
  },
  withSession: {
    host: 'example.com',
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
  secret: '%TEST_SECRET%',
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
// TERMINAL CONFIGURATION
// ============================================================================

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
// TYPE EXPORTS
// ============================================================================

export type TestCredentials = typeof SSH_TEST_CREDENTIALS
export type MockCredentials = typeof MOCK_CREDENTIALS