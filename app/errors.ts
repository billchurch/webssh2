// server
// app/errors.ts

import type { Response } from 'express';
import { logError, createNamespacedDebug } from './logger.js';
import { HTTP, MESSAGES } from './constants.js';

const debug = createNamespacedDebug('errors');

/**
 * Custom error for WebSSH2
 */
export class WebSSH2Error extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

/**
 * Custom error for configuration issues
 */
export class ConfigError extends WebSSH2Error {
  constructor(message: string) {
    super(message, MESSAGES.CONFIG_ERROR);
  }
}

/**
 * Custom error for SSH connection issues
 */
export class SSHConnectionError extends WebSSH2Error {
  constructor(message: string) {
    super(message, MESSAGES.SSH_CONNECTION_ERROR);
  }
}

/**
 * Handles an error by logging it and optionally sending a response
 * @param err - The error to handle
 * @param res - The response object (if in an Express route)
 */
export function handleError(err: Error | unknown, res?: Response): void {
  if (err instanceof WebSSH2Error) {
    logError(err.message, err);
    debug(err.message);
    if (res) {
      res.status(HTTP.INTERNAL_SERVER_ERROR).json({ error: err.message, code: err.code });
    }
  } else {
    logError(MESSAGES.UNEXPECTED_ERROR, err);
    debug(`handleError: ${MESSAGES.UNEXPECTED_ERROR}: %O`, err);
    if (res) {
      res.status(HTTP.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.UNEXPECTED_ERROR });
    }
  }
}