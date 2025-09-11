import type { Request, Response } from 'express'
export default function handleConnection(
  req: Request & { session?: Record<string, unknown>; sessionID?: string },
  res: Response,
  opts?: { host?: string }
): Promise<void>
