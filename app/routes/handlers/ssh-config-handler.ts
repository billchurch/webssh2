// app/routes/handlers/ssh-config-handler.ts
// Pure handler for exposing SSH configuration to clients

import { HTTP } from '../../constants/index.js'
import type { Config } from '../../types/config.js'
import type { Result } from '../../types/result.js'
import { ok } from '../../utils/index.js'
import type { SshRouteRequest, SshRouteResponse } from './ssh-handler.js'
import type { SshConfigResponse } from '../../types/contracts/v1/http.js'
import type { AuthMethodToken } from '../../types/branded.js'

export function createSshConfigResponse(
  _request: SshRouteRequest,
  config: Config
): Result<SshRouteResponse> {
  const hostKeyVerificationConfig = config.ssh.hostKeyVerification
  const payload: SshConfigResponse = {
    allowedAuthMethods: config.ssh.allowedAuthMethods.map(
      (method) => `${method}` as AuthMethodToken
    ),
    hostKeyVerification: {
      enabled: hostKeyVerificationConfig.enabled,
      clientStoreEnabled: hostKeyVerificationConfig.clientStore.enabled,
      unknownKeyAction: hostKeyVerificationConfig.unknownKeyAction,
    },
  }

  return ok({
    status: HTTP.OK,
    headers: { 'Cache-Control': 'no-store' },
    data: payload,
  })
}
