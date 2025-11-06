// app/types/contracts/v1/http.ts
// HTTP contract definitions for SSH routes

import type { AuthMethodToken } from '../../branded.js'

export interface SshConfigResponse {
  allowedAuthMethods: AuthMethodToken[]
}
