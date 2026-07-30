// tests/unit/connection-handler/injection-test-helpers.ts
// Shared request/config scaffolding for buildTempConfig injection-slice tests
// (terminal-injection.vitest.ts, transport-injection.vitest.ts) (#549)

import type { Request } from 'express'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import type { AuthSession } from '../../../app/auth/auth-utils.js'
import type { Config } from '../../../app/types/config.js'
import { TEST_SSH } from '../../test-constants.js'

export type TestReq = Request & { session?: AuthSession; sessionID?: string }

export function makeReq(): TestReq {
  return {
    path: '/host/',
    protocol: 'https',
    get: ((key: string) =>
      key === 'host' ? TEST_SSH.HOST : undefined) as unknown as Request['get'],
    session: {
      sshCredentials: {
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        term: 'xterm'
      },
      usedBasicAuth: false,
      authMethod: 'password',
      headerOverride: undefined
    },
    sessionID: 'test-session-id'
  } as TestReq
}

export const defaultConfig: Config = createDefaultConfig()
