// tests/unit/security-posture.vitest.ts
// Unit tests for the startup security posture audit

import { describe, it, expect } from 'vitest'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import { auditSecurityPosture, type SecurityPostureWarning } from '../../app/security-posture.js'
import type { Config } from '../../app/types/config.js'
import { TEST_SUBNETS } from '../test-constants.js'

function findWarning(
  warnings: SecurityPostureWarning[],
  check: SecurityPostureWarning['check']
): SecurityPostureWarning | undefined {
  return warnings.find((warning) => warning.check === check)
}

function createHardenedConfig(): Config {
  const config = createDefaultConfig()
  config.ssh.hostKeyVerification.enabled = true
  config.ssh.allowedSubnets = [TEST_SUBNETS.PRIVATE_10]
  if (config.telnet !== undefined) {
    config.telnet.allowedSubnets = [TEST_SUBNETS.PRIVATE_10]
  }
  return config
}

describe('auditSecurityPosture', () => {
  it('flags host key verification and ssh subnets on the default config', () => {
    const warnings = auditSecurityPosture(createDefaultConfig())

    expect(warnings).toHaveLength(2)
    expect(findWarning(warnings, 'host_key_verification_disabled')).toBeDefined()
    expect(findWarning(warnings, 'ssh_allowed_subnets_empty')).toBeDefined()
  })

  it('does not flag telnet subnets when telnet is disabled (default)', () => {
    const warnings = auditSecurityPosture(createDefaultConfig())

    expect(findWarning(warnings, 'telnet_allowed_subnets_empty')).toBeUndefined()
  })

  it('flags telnet subnets when telnet is enabled with empty subnets', () => {
    const config = createDefaultConfig()
    if (config.telnet !== undefined) {
      config.telnet.enabled = true
    }

    const warnings = auditSecurityPosture(config)

    expect(findWarning(warnings, 'telnet_allowed_subnets_empty')).toBeDefined()
  })

  it('does not flag telnet subnets when telnet is enabled with subnets configured', () => {
    const config = createDefaultConfig()
    if (config.telnet !== undefined) {
      config.telnet.enabled = true
      config.telnet.allowedSubnets = [TEST_SUBNETS.PRIVATE_192]
    }

    const warnings = auditSecurityPosture(config)

    expect(findWarning(warnings, 'telnet_allowed_subnets_empty')).toBeUndefined()
  })

  it('treats whitespace-only subnet entries as empty', () => {
    const config = createDefaultConfig()
    config.ssh.allowedSubnets = [' ']

    const warnings = auditSecurityPosture(config)

    expect(findWarning(warnings, 'ssh_allowed_subnets_empty')).toBeDefined()
  })

  it('treats blank-string subnet entries as empty', () => {
    const config = createDefaultConfig()
    config.ssh.allowedSubnets = ['']
    if (config.telnet !== undefined) {
      config.telnet.enabled = true
      config.telnet.allowedSubnets = ['', ' ']
    }

    const warnings = auditSecurityPosture(config)

    expect(findWarning(warnings, 'ssh_allowed_subnets_empty')).toBeDefined()
    expect(findWarning(warnings, 'telnet_allowed_subnets_empty')).toBeDefined()
  })

  it('does not treat a real subnet alongside a blank entry as empty', () => {
    const config = createDefaultConfig()
    config.ssh.allowedSubnets = ['', TEST_SUBNETS.PRIVATE_10]

    const warnings = auditSecurityPosture(config)

    expect(findWarning(warnings, 'ssh_allowed_subnets_empty')).toBeUndefined()
  })

  it('returns zero warnings for a fully hardened config', () => {
    const warnings = auditSecurityPosture(createHardenedConfig())

    expect(warnings).toHaveLength(0)
  })

  it('returns zero warnings for a hardened config with telnet enabled', () => {
    const config = createHardenedConfig()
    if (config.telnet !== undefined) {
      config.telnet.enabled = true
    }

    const warnings = auditSecurityPosture(config)

    expect(warnings).toHaveLength(0)
  })

  it('does not crash on a partial hand-built config', () => {
    const partial = { ssh: {} } as unknown as Config

    const warnings = auditSecurityPosture(partial)

    expect(findWarning(warnings, 'host_key_verification_disabled')).toBeDefined()
    expect(findWarning(warnings, 'ssh_allowed_subnets_empty')).toBeDefined()
    expect(findWarning(warnings, 'telnet_allowed_subnets_empty')).toBeUndefined()
  })

  it('treats undefined telnet allowedSubnets as empty when telnet is enabled', () => {
    const partial = { ssh: {}, telnet: { enabled: true } } as unknown as Config

    const warnings = auditSecurityPosture(partial)

    expect(findWarning(warnings, 'telnet_allowed_subnets_empty')).toBeDefined()
  })

  it('names the right config key in each warning', () => {
    const config = createDefaultConfig()
    if (config.telnet !== undefined) {
      config.telnet.enabled = true
    }

    const warnings = auditSecurityPosture(config)

    const hostKey = findWarning(warnings, 'host_key_verification_disabled')
    expect(hostKey?.configKey).toBe('ssh.hostKeyVerification.enabled')
    expect(hostKey?.message).toContain('host key verification')
    expect(hostKey?.remediation).toContain('ssh.hostKeyVerification.enabled')

    const sshSubnets = findWarning(warnings, 'ssh_allowed_subnets_empty')
    expect(sshSubnets?.configKey).toBe('ssh.allowedSubnets')
    expect(sshSubnets?.message).toContain('ssh.allowedSubnets')
    expect(sshSubnets?.remediation).toContain('ssh.allowedSubnets')

    const telnetSubnets = findWarning(warnings, 'telnet_allowed_subnets_empty')
    expect(telnetSubnets?.configKey).toBe('telnet.allowedSubnets')
    expect(telnetSubnets?.message).toContain('telnet.allowedSubnets')
    expect(telnetSubnets?.remediation).toContain('telnet.allowedSubnets')
  })
})
