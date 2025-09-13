import type { Config } from './types/config.js'

declare module './ssh.impl.js' {
  export default class SSHConnection {
    constructor(config: Config)
    connect(creds: unknown): Promise<unknown>
    shell(
      options: {
        term?: string | null
        rows?: number
        cols?: number
        width?: number
        height?: number
      },
      envVars?: Record<string, string> | null
    ): Promise<unknown>
    exec(
      command: string,
      options?: {
        pty?: boolean
        term?: string
        rows?: number
        cols?: number
        width?: number
        height?: number
      },
      envVars?: Record<string, string>
    ): Promise<unknown>
    resizeTerminal(rows: number, cols: number): void
    end(): void
  }
}
