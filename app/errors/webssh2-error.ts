export type ErrorCode = string

export class WebSSH2Error extends Error {
  readonly code: ErrorCode

  constructor(message: string, code: ErrorCode) {
    super(message)
    this.name = new.target.name
    this.code = code
  }
}
