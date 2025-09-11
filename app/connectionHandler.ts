import type { Request, Response } from 'express'

import impl from './connectionHandler.impl.js'

// Keep runtime JS, expose strong types to TS consumers
type Sess = { [k: string]: unknown }
export default function handleConnection(
  req: Request & { session?: Sess; sessionID?: string },
  res: Response,
  opts?: { host?: string }
): Promise<void> {
  return (
    impl as unknown as (
      req: Request & { session?: Sess; sessionID?: string },
      res: Response,
      opts?: { host?: string }
    ) => Promise<void>
  )(req, res, opts)
}
