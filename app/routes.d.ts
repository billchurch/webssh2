import type { Router } from 'express'
import type { Config } from './types/config.js'

export function createRoutes(config: Config): Router

export function processHeaderParameters(source: unknown, session: unknown): void
export function processEnvironmentVariables(source: unknown, session: unknown): void
export function setupSshCredentials(
  session: unknown,
  opts: { host: unknown; port: unknown; username?: unknown; password?: unknown; term?: unknown }
): unknown
export function processSessionRecordingParams(body: unknown, session: unknown): void
export function handleRouteError(
  err: Error,
  res: { status: (c: number) => { send: (b: unknown) => void; json: (b: unknown) => void } }
): void
