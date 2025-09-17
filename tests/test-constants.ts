/**
 * Centralized test constants for all test files
 * This file contains all test credentials, passwords, and secrets
 * to avoid SonarQube S2068 violations spread across multiple files
 * 
 * SonarQube exclusion: This file is excluded from SonarQube analysis
 * in sonar-project.properties
 */

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

// SSH test credentials
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

// SSO header names (not actual passwords, but often flagged)
export const SSO_HEADERS = {
  username: 'x-apm-username',
  password: 'x-apm-password', //NOSONAR
  session: 'x-apm-session',
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

// Network and subnet constants for testing
export const TEST_SUBNETS = {
  PRIVATE_10: '10.0.0.0/8',
  PRIVATE_172: '172.16.0.0/12',
  PRIVATE_192: '192.168.1.0/24',
  LOCALHOST: '127.0.0.0/8',
  ANY: '0.0.0.0/0'
} as const

export const TEST_IPS = {
  ANY: '0.0.0.0',
  LOCALHOST: '127.0.0.1',
  PRIVATE_10: '10.0.0.1',
  PRIVATE_172: '172.16.0.1',
  PRIVATE_192: '192.168.1.1'
} as const

export type TestCredentials = typeof SSH_TEST_CREDENTIALS
export type MockCredentials = typeof MOCK_CREDENTIALS