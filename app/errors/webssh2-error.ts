export class WebSSH2Error extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = new.target.name
    this.code = code
  }
}
