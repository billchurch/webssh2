// app/security-posture.ts
// Pure audit of security-relevant configuration defaults.
// Emits warnings for permissive defaults so operators harden deployments.

import type { Config } from './types/config.js'

export interface SecurityPostureWarning {
  readonly check:
    | 'host_key_verification_disabled'
    | 'ssh_allowed_subnets_empty'
    | 'telnet_allowed_subnets_empty'
  readonly configKey: string
  readonly message: string
  readonly remediation: string
}

// Structural view of the fields this audit inspects. Everything is optional
// so the audit tolerates partial or hand-built configs without crashing.
interface SecurityPostureView {
  readonly ssh?: {
    readonly hostKeyVerification?: { readonly enabled?: boolean }
    readonly allowedSubnets?: readonly string[]
  }
  readonly telnet?: {
    readonly enabled?: boolean
    readonly allowedSubnets?: readonly string[]
  }
}

const HOST_KEY_WARNING: SecurityPostureWarning = {
  check: 'host_key_verification_disabled',
  configKey: 'ssh.hostKeyVerification.enabled',
  message:
    'SECURITY WARNING: SSH host key verification is DISABLED (default). ' +
    'The gateway will accept ANY SSH host key, exposing sessions to man-in-the-middle attacks.',
  remediation:
    'Set ssh.hostKeyVerification.enabled=true (WEBSSH2_SSH_HOSTKEY_ENABLED=true), ' +
    "recommended with unknownKeyAction='prompt'. See SECURITY.md 'Default security posture'."
}

const SSH_SUBNETS_WARNING: SecurityPostureWarning = {
  check: 'ssh_allowed_subnets_empty',
  configKey: 'ssh.allowedSubnets',
  message:
    'SECURITY WARNING: ssh.allowedSubnets is empty (default). ' +
    'The gateway will connect to ANY host/port requested by clients (open SSH proxy / SSRF).',
  remediation:
    'Restrict destinations by setting ssh.allowedSubnets ' +
    "(WEBSSH2_SSH_ALLOWED_SUBNETS, CIDR list). See SECURITY.md 'Default security posture'."
}

const TELNET_SUBNETS_WARNING: SecurityPostureWarning = {
  check: 'telnet_allowed_subnets_empty',
  configKey: 'telnet.allowedSubnets',
  message:
    'SECURITY WARNING: telnet.allowedSubnets is empty (default) while telnet is enabled. ' +
    'The gateway will connect to ANY host/port requested by clients (open telnet proxy / SSRF).',
  remediation:
    'Restrict destinations by setting telnet.allowedSubnets ' +
    "(WEBSSH2_TELNET_ALLOWED_SUBNETS, CIDR list). See SECURITY.md 'Default security posture'."
}

function isSubnetListEmpty(subnets: readonly string[] | undefined): boolean {
  return subnets === undefined || subnets.filter((s) => s.trim().length > 0).length === 0
}

export function auditSecurityPosture(config: Config): SecurityPostureWarning[] {
  const view: SecurityPostureView = config
  const warnings: SecurityPostureWarning[] = []

  if (view.ssh?.hostKeyVerification?.enabled !== true) {
    warnings.push(HOST_KEY_WARNING)
  }

  if (isSubnetListEmpty(view.ssh?.allowedSubnets)) {
    warnings.push(SSH_SUBNETS_WARNING)
  }

  if (view.telnet?.enabled === true && isSubnetListEmpty(view.telnet.allowedSubnets)) {
    warnings.push(TELNET_SUBNETS_WARNING)
  }

  return warnings
}
