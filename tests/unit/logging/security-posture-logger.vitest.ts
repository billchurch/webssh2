// tests/unit/logging/security-posture-logger.vitest.ts
// Emitter tests for logSecurityPostureWarning

import { afterEach, describe, expect, it, vi } from 'vitest'
import { logSecurityPostureWarning } from '../../../app/logger.js'
import type { SecurityPostureWarning } from '../../../app/security-posture.js'

const SAMPLE_WARNING: SecurityPostureWarning = {
  check: 'host_key_verification_disabled',
  configKey: 'ssh.hostKeyVerification.enabled',
  message: 'sample security posture message',
  remediation: 'sample remediation guidance'
}

describe('logSecurityPostureWarning', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits a warn-level security_posture event with remediation details', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    logSecurityPostureWarning(SAMPLE_WARNING)

    expect(writeSpy).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(String(writeSpy.mock.calls[0]?.[0])) as Record<string, unknown>
    expect(payload['level']).toBe('warn')
    expect(payload['event']).toBe('security_posture')
    expect(payload['message']).toBe(SAMPLE_WARNING.message)
    expect(payload['status']).toBe('failure')
    expect(payload['reason']).toBe(SAMPLE_WARNING.check)
    expect(payload['details']).toEqual({
      configKey: SAMPLE_WARNING.configKey,
      remediation: SAMPLE_WARNING.remediation
    })
  })
})
