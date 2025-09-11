import { HTTP, MESSAGES } from './constants.js'

export class WebSSH2Error extends Error {
  code: string
  constructor(message: string, code: string)
}

export class ConfigError extends WebSSH2Error {
  constructor(message: string)
}

export class SSHConnectionError extends WebSSH2Error {
  constructor(message: string)
}

export function handleError(
  err: Error,
  res?: { status: (code: number) => { json: (body: unknown) => void } }
): void

export { HTTP, MESSAGES }
