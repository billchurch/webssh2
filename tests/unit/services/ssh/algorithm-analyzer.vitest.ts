// tests/unit/services/ssh/algorithm-analyzer.vitest.ts
// Unit tests for SSH algorithm analyzer utility

import { describe, it, expect } from 'vitest'
import {
  findCommonAlgorithms,
  suggestPreset,
  generateEnvVarSuggestions,
  analyzeAlgorithms,
  type CategoryAnalysis
} from '../../../../app/services/ssh/algorithm-analyzer.js'
import {
  createEmptyAlgorithmSet,
  createClientSet,
  createLegacyServerSet,
  createModernServerSet,
  createSetWithCategory,
  type AlgorithmSet
} from './algorithm-test-fixtures.js'

describe('findCommonAlgorithms', () => {
  it('returns empty array when no common algorithms', () => {
    const client = ['curve25519-sha256', 'ecdh-sha2-nistp256']
    const server = ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1']

    expect(findCommonAlgorithms(client, server)).toEqual([])
  })

  it('returns common algorithms in client order', () => {
    const client = ['aes256-ctr', 'aes128-ctr', 'aes256-cbc']
    const server = ['aes128-ctr', 'aes256-cbc', '3des-cbc']

    expect(findCommonAlgorithms(client, server)).toEqual(['aes128-ctr', 'aes256-cbc'])
  })

  it('returns all algorithms when lists are identical', () => {
    const algorithms = ['hmac-sha2-256', 'hmac-sha1']

    expect(findCommonAlgorithms(algorithms, algorithms)).toEqual(algorithms)
  })

  it('handles empty client list', () => {
    expect(findCommonAlgorithms([], ['aes256-ctr'])).toEqual([])
  })

  it('handles empty server list', () => {
    expect(findCommonAlgorithms(['aes256-ctr'], [])).toEqual([])
  })

  it('handles both empty lists', () => {
    expect(findCommonAlgorithms([], [])).toEqual([])
  })
})

describe('analyzeAlgorithms', () => {
  describe('category analysis', () => {
    it('identifies common algorithms', () => {
      const client = createClientSet()
      const server = createLegacyServerSet()
      const analysis = analyzeAlgorithms(client, server)

      const kexAnalysis = analysis.categories.find(c => c.category === 'kex')
      expect(kexAnalysis?.common).toContain('diffie-hellman-group14-sha1')
    })

    it('identifies client-only algorithms', () => {
      const client = createClientSet()
      const server = createLegacyServerSet()
      const analysis = analyzeAlgorithms(client, server)

      const kexAnalysis = analysis.categories.find(c => c.category === 'kex')
      expect(kexAnalysis?.clientOnly).toContain('curve25519-sha256')
      expect(kexAnalysis?.clientOnly).toContain('ecdh-sha2-nistp256')
    })

    it('identifies server-only algorithms', () => {
      const client = createClientSet()
      const server = createLegacyServerSet()
      const analysis = analyzeAlgorithms(client, server)

      const kexAnalysis = analysis.categories.find(c => c.category === 'kex')
      expect(kexAnalysis?.serverOnly).toContain('diffie-hellman-group1-sha1')
    })

    it('sets hasMatch true when common algorithms exist', () => {
      const client = createClientSet()
      const server = createLegacyServerSet()
      const analysis = analyzeAlgorithms(client, server)

      const kexAnalysis = analysis.categories.find(c => c.category === 'kex')
      expect(kexAnalysis?.hasMatch).toBe(true)
    })

    it('sets hasMatch false when no common algorithms', () => {
      const client = createSetWithCategory('cipher', ['aes256-gcm@openssh.com'])
      const server = createSetWithCategory('cipher', ['3des-cbc'])
      const analysis = analyzeAlgorithms(client, server)

      const cipherAnalysis = analysis.categories.find(c => c.category === 'cipher')
      expect(cipherAnalysis?.hasMatch).toBe(false)
    })

    it('includes all five categories with correct labels', () => {
      const client = createClientSet()
      const server = createModernServerSet()
      const analysis = analyzeAlgorithms(client, server)

      expect(analysis.categories).toHaveLength(5)
      expect(analysis.categories.map(c => c.label)).toEqual([
        'Key Exchange',
        'Host Key',
        'Cipher',
        'MAC',
        'Compression'
      ])
    })
  })

  describe('mismatch detection', () => {
    it('detects mismatch when a category has no common algorithms', () => {
      const client: AlgorithmSet = {
        ...createClientSet(),
        cipher: ['aes256-gcm@openssh.com']
      }
      const server: AlgorithmSet = {
        ...createLegacyServerSet(),
        cipher: ['3des-cbc']
      }
      const analysis = analyzeAlgorithms(client, server)

      expect(analysis.hasAnyMismatch).toBe(true)
    })

    it('reports no mismatch when all categories have common algorithms', () => {
      const client = createClientSet()
      const server = createModernServerSet()
      const analysis = analyzeAlgorithms(client, server)

      expect(analysis.hasAnyMismatch).toBe(false)
    })

    it('reports no mismatch when both sets are empty', () => {
      const analysis = analyzeAlgorithms(createEmptyAlgorithmSet(), createEmptyAlgorithmSet())

      expect(analysis.hasAnyMismatch).toBe(false)
    })
  })

  describe('preset suggestion', () => {
    it('suggests legacy preset for servers with only legacy algorithms', () => {
      // Modern client with no overlap with legacy server
      const client: AlgorithmSet = {
        kex: ['curve25519-sha256'],
        serverHostKey: ['ssh-ed25519'],
        cipher: ['aes256-gcm@openssh.com'],
        mac: ['hmac-sha2-256'],
        compress: ['none']
      }
      const server: AlgorithmSet = {
        kex: ['diffie-hellman-group14-sha1'],
        serverHostKey: ['ssh-rsa'],
        cipher: ['aes128-cbc'],
        mac: ['hmac-sha1'],
        compress: ['none']
      }

      const analysis = analyzeAlgorithms(client, server)
      expect(analysis.suggestedPreset).toBe('legacy')
    })

    it('returns null preset when no mismatch exists', () => {
      const client = createClientSet()
      const server = createModernServerSet()
      const analysis = analyzeAlgorithms(client, server)

      expect(analysis.suggestedPreset).toBeNull()
    })
  })

  describe('env var suggestions', () => {
    it('generates suggestions for mismatched categories', () => {
      const client: AlgorithmSet = {
        kex: ['curve25519-sha256'],
        serverHostKey: ['ssh-ed25519'],
        cipher: ['aes256-gcm@openssh.com'],
        mac: ['hmac-sha2-256'],
        compress: ['none']
      }
      const server: AlgorithmSet = {
        kex: ['diffie-hellman-group14-sha1'],
        serverHostKey: ['ssh-rsa'],
        cipher: ['aes128-cbc'],
        mac: ['hmac-sha1'],
        compress: ['none']
      }

      const analysis = analyzeAlgorithms(client, server)

      expect(analysis.suggestedEnvVars).toContain('WEBSSH2_SSH_ALGORITHMS_KEX=diffie-hellman-group14-sha1')
      expect(analysis.suggestedEnvVars).toContain('WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY=ssh-rsa')
      expect(analysis.suggestedEnvVars).toContain('WEBSSH2_SSH_ALGORITHMS_CIPHER=aes128-cbc')
      expect(analysis.suggestedEnvVars).toContain('WEBSSH2_SSH_ALGORITHMS_HMAC=hmac-sha1')
    })

    it('does not generate suggestions for categories with matches', () => {
      const client: AlgorithmSet = {
        kex: ['curve25519-sha256', 'diffie-hellman-group14-sha1'],
        serverHostKey: ['ssh-ed25519'],
        cipher: ['aes256-gcm@openssh.com'],
        mac: ['hmac-sha2-256'],
        compress: ['none']
      }
      const server: AlgorithmSet = {
        kex: ['diffie-hellman-group14-sha1'],
        serverHostKey: ['ssh-rsa'],
        cipher: ['aes128-cbc'],
        mac: ['hmac-sha1'],
        compress: ['none']
      }

      const analysis = analyzeAlgorithms(client, server)

      // KEX has a match, so no suggestion for it
      const kexSuggestion = analysis.suggestedEnvVars.find(s => s.includes('KEX'))
      expect(kexSuggestion).toBeUndefined()
    })

    it('returns empty array when no mismatch exists', () => {
      const client = createClientSet()
      const server = createModernServerSet()
      const analysis = analyzeAlgorithms(client, server)

      expect(analysis.suggestedEnvVars).toEqual([])
    })
  })
})

describe('suggestPreset', () => {
  it('suggests strict preset for strict-compatible servers', () => {
    const server: AlgorithmSet = {
      kex: ['ecdh-sha2-nistp256', 'curve25519-sha256'],
      serverHostKey: ['ecdsa-sha2-nistp256', 'ssh-ed25519'],
      cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com'],
      mac: ['hmac-sha2-256', 'hmac-sha2-512'],
      compress: ['none']
    }

    expect(suggestPreset(server)).toBe('strict')
  })

  it('suggests modern preset for servers that need modern but not strict', () => {
    // Server only supports algorithms in modern preset but NOT in strict preset
    const server: AlgorithmSet = {
      kex: ['ecdh-sha2-nistp384'],  // In modern, NOT in strict
      serverHostKey: ['ecdsa-sha2-nistp384'],  // In modern, NOT in strict
      cipher: ['aes128-ctr'],  // In modern, NOT in strict
      mac: ['hmac-sha2-512'],  // In modern, NOT in strict
      compress: ['none']
    }

    expect(suggestPreset(server)).toBe('modern')
  })

  it('suggests legacy preset for legacy servers', () => {
    const server: AlgorithmSet = {
      kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'],
      serverHostKey: ['ssh-rsa', 'ssh-dss'],
      cipher: ['aes128-cbc', '3des-cbc'],
      mac: ['hmac-sha1', 'hmac-md5'],
      compress: ['none']
    }

    expect(suggestPreset(server)).toBe('legacy')
  })

  it('returns null for servers with completely incompatible algorithms', () => {
    const server: AlgorithmSet = {
      kex: ['unknown-kex-algorithm'],
      serverHostKey: ['unknown-hostkey'],
      cipher: ['unknown-cipher'],
      mac: ['unknown-mac'],
      compress: ['none']
    }

    expect(suggestPreset(server)).toBeNull()
  })

  it('handles empty server algorithm set', () => {
    const server = createEmptyAlgorithmSet()

    // Empty set should match any preset since there are no requirements
    expect(suggestPreset(server)).toBe('strict')
  })
})

describe('generateEnvVarSuggestions', () => {
  it('generates correct env var names for each category', () => {
    const categories: CategoryAnalysis[] = [
      { category: 'kex', label: 'Key Exchange', common: [], clientOnly: ['client-kex'], serverOnly: ['server-kex'], hasMatch: false },
      { category: 'serverHostKey', label: 'Host Key', common: [], clientOnly: ['client-hk'], serverOnly: ['server-hk'], hasMatch: false },
      { category: 'cipher', label: 'Cipher', common: [], clientOnly: ['client-cipher'], serverOnly: ['server-cipher'], hasMatch: false },
      { category: 'mac', label: 'MAC', common: [], clientOnly: ['client-mac'], serverOnly: ['server-mac'], hasMatch: false },
      { category: 'compress', label: 'Compression', common: [], clientOnly: ['client-compress'], serverOnly: ['server-compress'], hasMatch: false }
    ]

    const suggestions = generateEnvVarSuggestions(categories)

    expect(suggestions).toContain('WEBSSH2_SSH_ALGORITHMS_KEX=server-kex')
    expect(suggestions).toContain('WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY=server-hk')
    expect(suggestions).toContain('WEBSSH2_SSH_ALGORITHMS_CIPHER=server-cipher')
    expect(suggestions).toContain('WEBSSH2_SSH_ALGORITHMS_HMAC=server-mac')
    expect(suggestions).toContain('WEBSSH2_SSH_ALGORITHMS_COMPRESS=server-compress')
  })

  it('skips categories with matches', () => {
    const categories: CategoryAnalysis[] = [
      { category: 'kex', label: 'Key Exchange', common: ['shared-kex'], clientOnly: [], serverOnly: [], hasMatch: true },
      { category: 'cipher', label: 'Cipher', common: [], clientOnly: ['client-cipher'], serverOnly: ['server-cipher'], hasMatch: false }
    ]

    const suggestions = generateEnvVarSuggestions(categories)

    expect(suggestions).not.toContain('WEBSSH2_SSH_ALGORITHMS_KEX=shared-kex')
    expect(suggestions).toContain('WEBSSH2_SSH_ALGORITHMS_CIPHER=server-cipher')
  })

  it('skips categories with no server algorithms', () => {
    const categories: CategoryAnalysis[] = [
      { category: 'kex', label: 'Key Exchange', common: [], clientOnly: ['client-kex'], serverOnly: [], hasMatch: false }
    ]

    const suggestions = generateEnvVarSuggestions(categories)

    expect(suggestions).toEqual([])
  })

  it('uses first server algorithm in suggestions', () => {
    const categories: CategoryAnalysis[] = [
      { category: 'cipher', label: 'Cipher', common: [], clientOnly: [], serverOnly: ['first-cipher', 'second-cipher', 'third-cipher'], hasMatch: false }
    ]

    const suggestions = generateEnvVarSuggestions(categories)

    expect(suggestions).toEqual(['WEBSSH2_SSH_ALGORITHMS_CIPHER=first-cipher'])
  })
})

describe('Integration: realistic algorithm mismatch scenarios', () => {
  it('analyzes modern client vs legacy server', () => {
    const client: AlgorithmSet = {
      kex: ['curve25519-sha256', 'ecdh-sha2-nistp256'],
      serverHostKey: ['ssh-ed25519', 'ecdsa-sha2-nistp256'],
      cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com'],
      mac: ['hmac-sha2-256-etm@openssh.com', 'hmac-sha2-256'],
      compress: ['none', 'zlib@openssh.com']
    }
    const server: AlgorithmSet = {
      kex: ['diffie-hellman-group14-sha1'],
      serverHostKey: ['ssh-rsa'],
      cipher: ['aes128-cbc', '3des-cbc'],
      mac: ['hmac-sha1'],
      compress: ['none']
    }

    const analysis = analyzeAlgorithms(client, server)

    // Should detect mismatch in KEX, host key, cipher, and MAC
    expect(analysis.hasAnyMismatch).toBe(true)

    // Compression should have a match (both have 'none')
    const compressAnalysis = analysis.categories.find(c => c.category === 'compress')
    expect(compressAnalysis?.hasMatch).toBe(true)
    expect(compressAnalysis?.common).toContain('none')

    // Should suggest legacy preset
    expect(analysis.suggestedPreset).toBe('legacy')

    // Should have env var suggestions for mismatched categories
    expect(analysis.suggestedEnvVars.length).toBeGreaterThan(0)
    expect(analysis.suggestedEnvVars.some(s => s.includes('KEX'))).toBe(true)
  })

  it('analyzes compatible client and server', () => {
    const client: AlgorithmSet = {
      kex: ['curve25519-sha256', 'ecdh-sha2-nistp256', 'diffie-hellman-group14-sha1'],
      serverHostKey: ['ssh-ed25519', 'ssh-rsa'],
      cipher: ['aes256-gcm@openssh.com', 'aes128-cbc'],
      mac: ['hmac-sha2-256', 'hmac-sha1'],
      compress: ['none']
    }
    const server: AlgorithmSet = {
      kex: ['diffie-hellman-group14-sha1'],
      serverHostKey: ['ssh-rsa'],
      cipher: ['aes128-cbc'],
      mac: ['hmac-sha1'],
      compress: ['none']
    }

    const analysis = analyzeAlgorithms(client, server)

    // Should not detect mismatch - all categories have at least one common algorithm
    expect(analysis.hasAnyMismatch).toBe(false)

    // No preset or env var suggestions needed
    expect(analysis.suggestedPreset).toBeNull()
    expect(analysis.suggestedEnvVars).toEqual([])

    // Each category should have hasMatch = true
    for (const category of analysis.categories) {
      expect(category.hasMatch).toBe(true)
    }
  })
})
