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
export const TEST_PASSWORD = 'testpass'
export const TEST_PASSWORD_ALT = 'testpassword'
export const INVALID_USERNAME = 'wronguser'
export const INVALID_PASSWORD = 'wrongpass'

// SSH test credentials
export const SSH_TEST_CREDENTIALS = {
  host: 'localhost',
  port: 22,
  username: TEST_USERNAME,
  password: TEST_PASSWORD,
} as const

export const SSH_INVALID_CREDENTIALS = {
  host: 'localhost',
  port: 22,
  username: TEST_USERNAME,
  password: INVALID_PASSWORD,
} as const

// Session and secrets
export const TEST_SECRET = 'test-secret'
export const TEST_SECRET_KEY = 'test-secret-key'
export const TEST_SECRET_LONG = 'test-secret-key-12345'
export const MY_SECRET = 'mysecret'

// SSO header names (not actual passwords, but often flagged)
export const SSO_HEADERS = {
  username: 'x-apm-username',
  password: 'x-apm-password',
  session: 'x-apm-session',
} as const

// SSO test values
export const SSO_TEST_VALUES = {
  username: 'apmuser',
  password: 'apmpass',
} as const

// Various test passwords used in different contexts
export const TEST_PASSWORDS = {
  basic: 'pass',
  basic123: 'pass123',
  session: 'session-password',
  state: 'state-password',
  test: 'test-password',
  secret: 'secret',
} as const

// Test credentials objects for different scenarios
export const MOCK_CREDENTIALS = {
  basic: {
    host: 'h',
    port: 22,
    username: 'u',
    password: 'p',
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

export type TestCredentials = typeof SSH_TEST_CREDENTIALS
export type MockCredentials = typeof MOCK_CREDENTIALS