// Reserved for ad-hoc ambient overrides; currently unused.
declare module '*/validators/exec-validate.js' {
  export function validateExecPayload(payload: unknown): {
    command: string
    pty?: boolean
    term?: string
    cols?: number
    rows?: number
    env?: Record<string, string>
    timeoutMs?: number
  }
}
