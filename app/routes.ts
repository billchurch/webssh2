// server
// app/routes.ts
// Type-only mirror that re-exports JS implementation without changing runtime

import type { Router } from 'express'
import * as Impl from './routes.js'
import type { Config } from './types/config.js'

// Re-export helpers with explicit types, delegating to JS implementation
export const processHeaderParameters: (source: unknown, session: unknown) => void =
  Impl.processHeaderParameters as unknown as (source: unknown, session: unknown) => void

export const processEnvironmentVariables: (source: unknown, session: unknown) => void =
  Impl.processEnvironmentVariables as unknown as (source: unknown, session: unknown) => void

export const setupSshCredentials: (
  session: unknown,
  opts: { host: unknown; port: unknown; username?: unknown; password?: unknown; term?: unknown }
) => unknown = Impl.setupSshCredentials as unknown as (
  session: unknown,
  opts: { host: unknown; port: unknown; username?: unknown; password?: unknown; term?: unknown }
) => unknown

export const processSessionRecordingParams: (body: unknown, session: unknown) => void =
  Impl.processSessionRecordingParams as unknown as (body: unknown, session: unknown) => void

export const handleRouteError: (
  err: Error,
  res: { status: (c: number) => { send: (b: unknown) => void; json: (b: unknown) => void } }
) => void = Impl.handleRouteError as unknown as (
  err: Error,
  res: { status: (c: number) => { send: (b: unknown) => void; json: (b: unknown) => void } }
) => void

// Main factory re-export with strong typing
export const createRoutes: (config: Config) => Router = Impl.createRoutes as unknown as (
  config: Config
) => Router
