// server
// /app/utils.ts

import validator from 'validator';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import maskObject from 'jsmasker';
import { createNamespacedDebug } from './logger.js';
import { DEFAULTS, MESSAGES } from './constants.js';
import configSchema, { type Config } from './configSchema.js';

const debug = createNamespacedDebug('utils');

/**
 * Credentials interface for SSH connections
 */
export interface Credentials {
  username: string;
  host: string;
  port: number;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

/**
 * Masking options for sensitive data
 */
export interface MaskOptions {
  properties?: string[];
  maskLength?: number;
  minLength?: number;
  maxLength?: number;
  maskChar?: string;
  fullMask?: boolean;
}

/**
 * Deep merges two objects
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns The merged object
 */
export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const output = { ...target };
  Object.keys(source).forEach((key) => {
    if (Object.hasOwn(source, key)) {
      if (source[key] instanceof Object && !Array.isArray(source[key]) && source[key] !== null) {
        output[key] = deepMerge(output[key] as Record<string, unknown> || {}, source[key] as Record<string, unknown>);
      } else {
        output[key] = source[key];
      }
    }
  });
  return output;
}

/**
 * Determines if a given host is an IP address or a hostname.
 * If it's a hostname, it escapes it for safety.
 *
 * @param host - The host string to validate and escape.
 * @returns - The original IP or escaped hostname.
 */
export function getValidatedHost(host: string): string {
  let validatedHost: string;

  if (validator.isIP(host)) {
    validatedHost = host;
  } else {
    validatedHost = validator.escape(host);
  }

  return validatedHost;
}

/**
 * Validates and sanitizes a port value.
 * If no port is provided, defaults to port 22.
 * If a port is provided, checks if it is a valid port number (1-65535).
 * If the port is invalid, defaults to port 22.
 *
 * @param portInput - The port string to validate and parse.
 * @returns - The validated port number.
 */
export function getValidatedPort(portInput?: string): number {
  const defaultPort = DEFAULTS.SSH_PORT;
  const port = defaultPort;
  debug('getValidatedPort: input: %O', portInput);

  if (portInput) {
    if (validator.isInt(portInput, { min: 1, max: 65535 })) {
      return parseInt(portInput, 10);
    }
  }
  debug('getValidatedPort: port not specified or is invalid, setting port to: %O', port);

  return port;
}

/**
 * Checks if the provided credentials object is valid.
 * Valid credentials must have:
 * - username (string)
 * - host (string)
 * - port (number)
 * AND either:
 * - password (string) OR
 * - privateKey (string) with optional passphrase (string)
 *
 * @param creds - The credentials object.
 * @returns - Returns true if the credentials are valid, otherwise false.
 */
export function isValidCredentials(creds: unknown): creds is Credentials {
  if (!creds || typeof creds !== 'object') {
    return false;
  }

  const credsObj = creds as Record<string, unknown>;

  const hasRequiredFields = !!(
    credsObj &&
    typeof credsObj['username'] === 'string' &&
    typeof credsObj['host'] === 'string' &&
    typeof credsObj['port'] === 'number'
  );

  if (!hasRequiredFields) {
    return false;
  }

  // Must have either password or privateKey
  const hasPassword = typeof credsObj['password'] === 'string';
  const hasPrivateKey = typeof credsObj['privateKey'] === 'string';

  // Passphrase is optional but must be string if provided
  const hasValidPassphrase = !credsObj['passphrase'] || typeof credsObj['passphrase'] === 'string';

  return (hasPassword || hasPrivateKey) && hasValidPassphrase;
}

/**
 * Validates and sanitizes the SSH terminal name using validator functions.
 * Allows alphanumeric characters, hyphens, and periods.
 * Returns null if the terminal name is invalid or not provided.
 *
 * @param term - The terminal name to validate.
 * @returns - The sanitized terminal name if valid, null otherwise.
 */
export function validateSshTerm(term?: string): string | null {
  debug(`validateSshTerm: %O`, term);

  if (!term) {
    return null;
  }

  const validatedSshTerm =
    validator.isLength(term, { min: 1, max: 30 }) && validator.matches(term, /^[a-zA-Z0-9.-]+$/);

  return validatedSshTerm ? term : null;
}

/**
 * Validates the given configuration object.
 *
 * @param config - The configuration object to validate.
 * @throws If the configuration object fails validation.
 * @returns The validated configuration object.
 */
export function validateConfig(config: unknown): Config {
  const ajv = new Ajv.default();
  addFormats.default(ajv);
  const validate = ajv.compile(configSchema);
  const valid = validate(config);
  if (!valid) {
    throw new Error(`${MESSAGES.CONFIG_VALIDATION_ERROR}: ${ajv.errorsText(validate.errors)}`);
  }
  return config as Config;
}

/**
 * Modify the HTML content by replacing certain placeholders with dynamic values.
 * @param html - The original HTML content.
 * @param config - The configuration object to inject into the HTML.
 * @returns - The modified HTML content.
 */
export function modifyHtml(html: string, config: Record<string, unknown>): string {
  debug('modifyHtml');
  const modifiedHtml = html.replace(/(src|href)="(?!http|\/\/)/g, '$1="/ssh/assets/');

  return modifiedHtml.replace(
    'window.webssh2Config = null;',
    `window.webssh2Config = ${JSON.stringify(config)};`
  );
}

/**
 * Masks sensitive information in an object
 * @param obj - The object to mask
 * @param options - Optional configuration for masking
 * @returns The masked object
 */
export function maskSensitiveData(obj: Record<string, unknown>, options?: MaskOptions): Record<string, unknown> {
  const defaultOptions: MaskOptions = {
    properties: ['password', 'privateKey', 'passphrase', 'key', 'secret', 'token'],
  };
  debug('maskSensitiveData');

  const maskingOptions = { ...defaultOptions, ...(options || {}) };
  const maskedObject = maskObject(obj, maskingOptions) as Record<string, unknown>;

  return maskedObject;
}

/**
 * Validates and sanitizes environment variable key names
 * @param key - The environment variable key to validate
 * @returns - Whether the key is valid
 */
export function isValidEnvKey(key: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(key);
}

/**
 * Validates and sanitizes environment variable values
 * @param value - The environment variable value to validate
 * @returns - Whether the value is valid
 */
export function isValidEnvValue(value: string): boolean {
  // Disallow special characters that could be used for command injection
  return !/[;&|`$]/.test(value);
}

/**
 * Parses and validates environment variables from URL query string
 * @param envString - The environment string from URL query
 * @returns - Object containing validated env vars or null if invalid
 */
export function parseEnvVars(envString: string): Record<string, string> | null {
  if (!envString) {
    return null;
  }

  const envVars: Record<string, string> = {};
  const pairs = envString.split(',');

  for (const pairString of pairs) {
    const pair = pairString.split(':');
    if (pair.length !== 2) {
      continue;
    }

    const key = pair[0]?.trim();
    const value = pair[1]?.trim();
    
    if (!key || !value) {
      continue;
    }

    if (isValidEnvKey(key) && isValidEnvValue(value)) {
      envVars[key] = value;
    } else {
      debug(`parseEnvVars: Invalid env var pair: ${key}:${value}`);
    }
  }

  return Object.keys(envVars).length > 0 ? envVars : null;
}