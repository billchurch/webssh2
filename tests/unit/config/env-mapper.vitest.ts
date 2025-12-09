// tests/unit/config/env-mapper.vitest.ts
// Unit tests for environment variable mapping with algorithm preset precedence

import { describe, it, expect } from 'vitest'
import { mapEnvironmentVariables } from '../../../app/config/env-mapper.js'

describe('mapEnvironmentVariables', () => {
  describe('algorithm preset precedence', () => {
    it('applies preset when only preset is specified', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'modern'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          algorithms: {
            cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes128-ctr'],
            kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
            hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
            compress: ['none', 'zlib@openssh.com'],
            serverHostKey: ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa']
          }
        }
      })
    })

    it('individual HMAC setting overrides preset HMAC', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'modern',
        WEBSSH2_SSH_ALGORITHMS_HMAC: 'hmac-sha1,hmac-sha2-256,hmac-sha2-512'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          algorithms: {
            cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes128-ctr'],
            kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
            hmac: ['hmac-sha1', 'hmac-sha2-256', 'hmac-sha2-512'], // Individual override
            compress: ['none', 'zlib@openssh.com'],
            serverHostKey: ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa']
          }
        }
      })
    })

    it('individual cipher setting overrides preset cipher', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'modern',
        WEBSSH2_SSH_ALGORITHMS_CIPHER: 'aes256-cbc,aes128-cbc'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          algorithms: {
            cipher: ['aes256-cbc', 'aes128-cbc'], // Individual override
            kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
            hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
            compress: ['none', 'zlib@openssh.com'],
            serverHostKey: ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa']
          }
        }
      })
    })

    it('individual KEX setting overrides preset KEX', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'modern',
        WEBSSH2_SSH_ALGORITHMS_KEX: 'diffie-hellman-group14-sha256'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          algorithms: {
            cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes128-ctr'],
            kex: ['diffie-hellman-group14-sha256'], // Individual override
            hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
            compress: ['none', 'zlib@openssh.com'],
            serverHostKey: ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa']
          }
        }
      })
    })

    it('multiple individual settings override multiple preset values', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'modern',
        WEBSSH2_SSH_ALGORITHMS_HMAC: 'hmac-sha1,hmac-sha2-256',
        WEBSSH2_SSH_ALGORITHMS_CIPHER: 'aes256-cbc',
        WEBSSH2_SSH_ALGORITHMS_COMPRESS: 'zlib'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          algorithms: {
            cipher: ['aes256-cbc'], // Individual override
            kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'], // From preset
            hmac: ['hmac-sha1', 'hmac-sha2-256'], // Individual override
            compress: ['zlib'], // Individual override
            serverHostKey: ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa']
          }
        }
      })
    })

    it('individual settings work without preset', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_HMAC: 'hmac-sha1,hmac-sha2-256',
        WEBSSH2_SSH_ALGORITHMS_CIPHER: 'aes256-cbc'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          algorithms: {
            cipher: ['aes256-cbc'],
            hmac: ['hmac-sha1', 'hmac-sha2-256']
          }
        }
      })
    })

    it('applies legacy preset correctly', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'legacy'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          algorithms: {
            cipher: ['aes256-cbc', 'aes192-cbc', 'aes128-cbc', '3des-cbc'],
            kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'],
            hmac: ['hmac-sha1', 'hmac-md5'],
            compress: ['none', 'zlib'],
            serverHostKey: ['ssh-rsa', 'ssh-dss']
          }
        }
      })
    })

    it('applies strict preset correctly', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'strict'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          algorithms: {
            cipher: ['aes256-gcm@openssh.com'],
            kex: ['ecdh-sha2-nistp256'],
            hmac: ['hmac-sha2-256'],
            compress: ['none'],
            serverHostKey: ['ecdsa-sha2-nistp256']
          }
        }
      })
    })

    it('ignores invalid preset name', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'invalid-preset-name'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({})
    })

    it('case-insensitive preset names', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'MODERN'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          algorithms: {
            cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes128-ctr'],
            kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
            hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
            compress: ['none', 'zlib@openssh.com'],
            serverHostKey: ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa']
          }
        }
      })
    })
  })

  describe('other environment variables', () => {
    it('maps PORT to listen.port', () => {
      const env = {
        PORT: '3000'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        listen: {
          port: 3000
        }
      })
    })

    it('maps WEBSSH2_LISTEN_IP and WEBSSH2_LISTEN_PORT', () => {
      const env = {
        WEBSSH2_LISTEN_IP: '127.0.0.1',
        WEBSSH2_LISTEN_PORT: '8080'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        listen: {
          ip: '127.0.0.1',
          port: 8080
        }
      })
    })

    it('maps SSH connection settings', () => {
      const env = {
        WEBSSH2_SSH_HOST: 'example.com',
        WEBSSH2_SSH_PORT: '2222',
        WEBSSH2_SSH_TERM: 'xterm-256color'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          host: 'example.com',
          port: 2222,
          term: 'xterm-256color'
        }
      })
    })

    it('maps array values correctly', () => {
      const env = {
        WEBSSH2_HTTP_ORIGINS: 'http://localhost:3000,https://example.com',
        WEBSSH2_SSH_ENV_ALLOWLIST: 'LANG,PATH,HOME'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        http: {
          origins: ['http://localhost:3000', 'https://example.com']
        },
        ssh: {
          envAllowlist: ['LANG', 'PATH', 'HOME']
        }
      })
    })

    it('maps boolean values correctly', () => {
      const env = {
        WEBSSH2_OPTIONS_CHALLENGE_BUTTON: 'true',
        WEBSSH2_OPTIONS_AUTO_LOG: 'false'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        options: {
          challengeButton: true,
          autoLog: false
        }
      })
    })

    it('ignores undefined environment variables', () => {
      const env = {
        WEBSSH2_SSH_HOST: 'example.com',
        SOME_OTHER_VAR: 'ignored'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          host: 'example.com'
        }
      })
    })

    it('maps complex nested paths correctly', () => {
      const env = {
        WEBSSH2_SSO_ENABLED: 'true',
        WEBSSH2_SSO_HEADER_USERNAME: 'X-Remote-User',
        WEBSSH2_SSO_HEADER_PASSWORD: 'X-Remote-Password'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        sso: {
          enabled: true,
          headerMapping: {
            username: 'X-Remote-User',
            password: 'X-Remote-Password'
          }
        }
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty environment object', () => {
      const result = mapEnvironmentVariables({})
      expect(result).toEqual({})
    })

    it('handles empty string values', () => {
      const env = {
        WEBSSH2_SSH_HOST: ''
      }

      const result = mapEnvironmentVariables(env)

      // Empty strings are parsed as null by the env parser
      expect(result).toEqual({
        ssh: {
          host: null
        }
      })
    })

    it('combines preset with non-algorithm settings', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'modern',
        WEBSSH2_SSH_HOST: 'example.com',
        WEBSSH2_SSH_PORT: '22',
        WEBSSH2_OPTIONS_AUTO_LOG: 'true'
      }

      const result = mapEnvironmentVariables(env)

      expect(result).toEqual({
        ssh: {
          host: 'example.com',
          port: 22,
          algorithms: {
            cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes128-ctr'],
            kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
            hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
            compress: ['none', 'zlib@openssh.com'],
            serverHostKey: ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa']
          }
        },
        options: {
          autoLog: true
        }
      })
    })
  })

  describe('real-world use cases', () => {
    it('government/legacy server requiring hmac-sha1 with modern preset', () => {
      // Use case from issue: extend modern preset with hmac-sha1 for legacy servers
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'modern',
        WEBSSH2_SSH_ALGORITHMS_HMAC: 'hmac-sha1,hmac-sha2-256,hmac-sha2-512'
      }

      const result = mapEnvironmentVariables(env)

      expect(result.ssh).toHaveProperty('algorithms')
      const algorithms = result.ssh as Record<string, unknown>
      expect(algorithms.algorithms).toHaveProperty('hmac')
      const algoObj = algorithms.algorithms as Record<string, unknown>
      expect(algoObj.hmac).toEqual(['hmac-sha1', 'hmac-sha2-256', 'hmac-sha2-512'])
      // Other preset values remain
      expect(algoObj.cipher).toEqual(['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes128-ctr'])
    })

    it('FIPS environment with custom server host keys', () => {
      const env = {
        WEBSSH2_SSH_ALGORITHMS_PRESET: 'strict',
        WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY: 'rsa-sha2-256,rsa-sha2-512'
      }

      const result = mapEnvironmentVariables(env)

      expect(result.ssh).toHaveProperty('algorithms')
      const algorithms = result.ssh as Record<string, unknown>
      expect(algorithms.algorithms).toHaveProperty('serverHostKey')
      const algoObj = algorithms.algorithms as Record<string, unknown>
      expect(algoObj.serverHostKey).toEqual(['rsa-sha2-256', 'rsa-sha2-512'])
      // Other strict preset values remain
      expect(algoObj.cipher).toEqual(['aes256-gcm@openssh.com'])
      expect(algoObj.hmac).toEqual(['hmac-sha2-256'])
    })
  })
})
