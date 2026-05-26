// app/constants/security.ts
// Security-related constants

/**
 * Password mask for logging and display
 * Using a constant avoids SonarQube S2068 violations
 */
export const PASSWORD_MASK = '********' //NOSONAR

/**
 * Default SSO header field names
 * These are configuration field names, not actual passwords
 */
export const DEFAULT_SSO_HEADERS = {
  username: 'x-forwarded-user',
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- HTTP header name, not a password
  password: 'x-forwarded-password',
  session: 'x-forwarded-session',
} as const