// tests/unit/services/ssh/algorithm-capture.vitest.ts
// Unit tests for SSH algorithm capture utility

import { describe, it, expect } from 'vitest'
import {
  parseAlgorithmDebugMessage,
  createAlgorithmCapture,
  createEmptyAlgorithmSet,
  createEmptyCapturedAlgorithms,
  hasAlgorithmData,
  type AlgorithmSet
} from '../../../../app/services/ssh/algorithm-capture.js'

describe('parseAlgorithmDebugMessage', () => {
  describe('KEX method parsing', () => {
    it('parses local KEX method', () => {
      const msg = 'Handshake: (local) KEX method: curve25519-sha256,ecdh-sha2-nistp256'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('local')
      expect(result?.category).toBe('kex')
      expect(result?.algorithms).toEqual(['curve25519-sha256', 'ecdh-sha2-nistp256'])
    })

    it('parses remote KEX method', () => {
      const msg = 'Handshake: (remote) KEX method: diffie-hellman-group14-sha1,diffie-hellman-group1-sha1'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('remote')
      expect(result?.category).toBe('kex')
      expect(result?.algorithms).toEqual(['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'])
    })
  })

  describe('Host key format parsing', () => {
    it('parses local host key format', () => {
      const msg = 'Handshake: (local) Host key format: ssh-ed25519,rsa-sha2-512,rsa-sha2-256'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('local')
      expect(result?.category).toBe('serverHostKey')
      expect(result?.algorithms).toEqual(['ssh-ed25519', 'rsa-sha2-512', 'rsa-sha2-256'])
    })

    it('parses remote host key format', () => {
      const msg = 'Handshake: (remote) Host key format: ssh-rsa'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('remote')
      expect(result?.category).toBe('serverHostKey')
      expect(result?.algorithms).toEqual(['ssh-rsa'])
    })
  })

  describe('Cipher parsing', () => {
    it('parses local C->S cipher', () => {
      const msg = 'Handshake: (local) C->S cipher: aes256-gcm@openssh.com,aes128-gcm@openssh.com'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('local')
      expect(result?.category).toBe('cipher')
      expect(result?.algorithms).toEqual(['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com'])
    })

    it('parses remote C->S cipher', () => {
      const msg = 'Handshake: (remote) C->S cipher: aes128-cbc,3des-cbc'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('remote')
      expect(result?.category).toBe('cipher')
      expect(result?.algorithms).toEqual(['aes128-cbc', '3des-cbc'])
    })
  })

  describe('MAC parsing', () => {
    it('parses local C->S MAC', () => {
      const msg = 'Handshake: (local) C->S MAC: hmac-sha2-256-etm@openssh.com,hmac-sha2-512'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('local')
      expect(result?.category).toBe('mac')
      expect(result?.algorithms).toEqual(['hmac-sha2-256-etm@openssh.com', 'hmac-sha2-512'])
    })

    it('parses remote C->S MAC', () => {
      const msg = 'Handshake: (remote) C->S MAC: hmac-sha1'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('remote')
      expect(result?.category).toBe('mac')
      expect(result?.algorithms).toEqual(['hmac-sha1'])
    })
  })

  describe('Compression parsing', () => {
    it('parses local C->S compression', () => {
      const msg = 'Handshake: (local) C->S compression: none,zlib@openssh.com,zlib'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('local')
      expect(result?.category).toBe('compress')
      expect(result?.algorithms).toEqual(['none', 'zlib@openssh.com', 'zlib'])
    })

    it('parses remote C->S compression', () => {
      const msg = 'Handshake: (remote) C->S compression: none'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result).not.toBeNull()
      expect(result?.source).toBe('remote')
      expect(result?.category).toBe('compress')
      expect(result?.algorithms).toEqual(['none'])
    })
  })

  describe('Non-matching messages', () => {
    it('returns null for non-handshake messages', () => {
      expect(parseAlgorithmDebugMessage('Connection established')).toBeNull()
      expect(parseAlgorithmDebugMessage('DEBUG: some debug message')).toBeNull()
      expect(parseAlgorithmDebugMessage('')).toBeNull()
    })

    it('returns null for handshake messages without algorithm info', () => {
      expect(parseAlgorithmDebugMessage('Handshake: KEX finished')).toBeNull()
      expect(parseAlgorithmDebugMessage('Handshake: (local) Unknown category')).toBeNull()
    })

    it('returns null for S->C messages (we only capture C->S direction)', () => {
      const msg = 'Handshake: (local) S->C cipher: aes256-gcm@openssh.com'
      expect(parseAlgorithmDebugMessage(msg)).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('handles algorithms with spaces after comma', () => {
      const msg = 'Handshake: (local) KEX method: curve25519-sha256, ecdh-sha2-nistp256'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result?.algorithms).toEqual(['curve25519-sha256', 'ecdh-sha2-nistp256'])
    })

    it('handles single algorithm', () => {
      const msg = 'Handshake: (remote) KEX method: diffie-hellman-group14-sha1'
      const result = parseAlgorithmDebugMessage(msg)

      expect(result?.algorithms).toEqual(['diffie-hellman-group14-sha1'])
    })
  })
})

describe('createAlgorithmCapture', () => {
  it('starts with no data', () => {
    const capture = createAlgorithmCapture()
    expect(capture.hasData()).toBe(false)
  })

  it('captures local algorithms as client', () => {
    const capture = createAlgorithmCapture()

    capture.parse('Handshake: (local) KEX method: curve25519-sha256')
    capture.parse('Handshake: (local) Host key format: ssh-ed25519')
    capture.parse('Handshake: (local) C->S cipher: aes256-gcm@openssh.com')
    capture.parse('Handshake: (local) C->S MAC: hmac-sha2-256')
    capture.parse('Handshake: (local) C->S compression: none')

    expect(capture.hasData()).toBe(true)

    const algorithms = capture.getAlgorithms()
    expect(algorithms.client.kex).toEqual(['curve25519-sha256'])
    expect(algorithms.client.serverHostKey).toEqual(['ssh-ed25519'])
    expect(algorithms.client.cipher).toEqual(['aes256-gcm@openssh.com'])
    expect(algorithms.client.mac).toEqual(['hmac-sha2-256'])
    expect(algorithms.client.compress).toEqual(['none'])
  })

  it('captures remote algorithms as server', () => {
    const capture = createAlgorithmCapture()

    capture.parse('Handshake: (remote) KEX method: diffie-hellman-group14-sha1')
    capture.parse('Handshake: (remote) Host key format: ssh-rsa')
    capture.parse('Handshake: (remote) C->S cipher: aes128-cbc')
    capture.parse('Handshake: (remote) C->S MAC: hmac-sha1')
    capture.parse('Handshake: (remote) C->S compression: none')

    const algorithms = capture.getAlgorithms()
    expect(algorithms.server.kex).toEqual(['diffie-hellman-group14-sha1'])
    expect(algorithms.server.serverHostKey).toEqual(['ssh-rsa'])
    expect(algorithms.server.cipher).toEqual(['aes128-cbc'])
    expect(algorithms.server.mac).toEqual(['hmac-sha1'])
    expect(algorithms.server.compress).toEqual(['none'])
  })

  it('captures both client and server algorithms', () => {
    const capture = createAlgorithmCapture()

    capture.parse('Handshake: (local) KEX method: curve25519-sha256')
    capture.parse('Handshake: (remote) KEX method: diffie-hellman-group14-sha1')
    capture.parse('Handshake: (local) Host key format: ssh-ed25519')
    capture.parse('Handshake: (remote) Host key format: ssh-rsa')

    const algorithms = capture.getAlgorithms()
    expect(algorithms.client.kex).toEqual(['curve25519-sha256'])
    expect(algorithms.server.kex).toEqual(['diffie-hellman-group14-sha1'])
    expect(algorithms.client.serverHostKey).toEqual(['ssh-ed25519'])
    expect(algorithms.server.serverHostKey).toEqual(['ssh-rsa'])
  })

  it('ignores non-algorithm messages', () => {
    const capture = createAlgorithmCapture()

    capture.parse('Connection established')
    capture.parse('DEBUG: some debug message')
    capture.parse('')

    expect(capture.hasData()).toBe(false)
  })

  it('first occurrence wins for same category', () => {
    const capture = createAlgorithmCapture()

    capture.parse('Handshake: (local) KEX method: first-kex')
    capture.parse('Handshake: (local) KEX method: second-kex')

    const algorithms = capture.getAlgorithms()
    expect(algorithms.client.kex).toEqual(['first-kex'])
  })

  it('returns a copy of algorithms to prevent mutation', () => {
    const capture = createAlgorithmCapture()
    capture.parse('Handshake: (local) KEX method: curve25519-sha256')

    const algorithms1 = capture.getAlgorithms()
    const algorithms2 = capture.getAlgorithms()

    expect(algorithms1).not.toBe(algorithms2)
    expect(algorithms1.client).not.toBe(algorithms2.client)
  })
})

describe('createEmptyAlgorithmSet', () => {
  it('creates empty algorithm set', () => {
    const set = createEmptyAlgorithmSet()

    expect(set.kex).toEqual([])
    expect(set.serverHostKey).toEqual([])
    expect(set.cipher).toEqual([])
    expect(set.mac).toEqual([])
    expect(set.compress).toEqual([])
  })
})

describe('createEmptyCapturedAlgorithms', () => {
  it('creates empty captured algorithms structure', () => {
    const captured = createEmptyCapturedAlgorithms()

    expect(hasAlgorithmData(captured.client)).toBe(false)
    expect(hasAlgorithmData(captured.server)).toBe(false)
  })
})

describe('hasAlgorithmData', () => {
  it('returns false for empty set', () => {
    const set = createEmptyAlgorithmSet()
    expect(hasAlgorithmData(set)).toBe(false)
  })

  it('returns true if kex has data', () => {
    const set: AlgorithmSet = { ...createEmptyAlgorithmSet(), kex: ['curve25519-sha256'] }
    expect(hasAlgorithmData(set)).toBe(true)
  })

  it('returns true if serverHostKey has data', () => {
    const set: AlgorithmSet = { ...createEmptyAlgorithmSet(), serverHostKey: ['ssh-ed25519'] }
    expect(hasAlgorithmData(set)).toBe(true)
  })

  it('returns true if cipher has data', () => {
    const set: AlgorithmSet = { ...createEmptyAlgorithmSet(), cipher: ['aes256-gcm'] }
    expect(hasAlgorithmData(set)).toBe(true)
  })

  it('returns true if mac has data', () => {
    const set: AlgorithmSet = { ...createEmptyAlgorithmSet(), mac: ['hmac-sha2-256'] }
    expect(hasAlgorithmData(set)).toBe(true)
  })

  it('returns true if compress has data', () => {
    const set: AlgorithmSet = { ...createEmptyAlgorithmSet(), compress: ['none'] }
    expect(hasAlgorithmData(set)).toBe(true)
  })
})

describe('Integration: realistic ssh2 debug output', () => {
  it('captures full handshake sequence', () => {
    const capture = createAlgorithmCapture()

    // Simulate realistic ssh2 debug output during handshake
    const debugMessages = [
      'Handshake: (local) KEX method: curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521,diffie-hellman-group-exchange-sha256,diffie-hellman-group14-sha256,diffie-hellman-group14-sha1',
      'Handshake: (remote) KEX method: diffie-hellman-group14-sha1,diffie-hellman-group1-sha1',
      'Handshake: (local) Host key format: ssh-ed25519-cert-v01@openssh.com,ecdsa-sha2-nistp256-cert-v01@openssh.com,ssh-ed25519,ecdsa-sha2-nistp256,rsa-sha2-512,rsa-sha2-256',
      'Handshake: (remote) Host key format: ssh-rsa',
      'Handshake: (local) C->S cipher: aes128-gcm@openssh.com,aes256-gcm@openssh.com,aes128-ctr,aes192-ctr,aes256-ctr',
      'Handshake: (remote) C->S cipher: aes128-cbc,3des-cbc,aes256-cbc',
      'Handshake: (local) Server->Client cipher: aes128-gcm@openssh.com,aes256-gcm@openssh.com,aes128-ctr,aes192-ctr,aes256-ctr',
      'Handshake: (remote) Server->Client cipher: aes128-cbc,3des-cbc,aes256-cbc',
      'Handshake: (local) C->S MAC: hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,hmac-sha1-etm@openssh.com,hmac-sha2-256,hmac-sha2-512,hmac-sha1',
      'Handshake: (remote) C->S MAC: hmac-sha1,hmac-md5',
      'Handshake: (local) C->S compression: none,zlib@openssh.com,zlib',
      'Handshake: (remote) C->S compression: none',
      'Handshake: KEX finished',
    ]

    for (const msg of debugMessages) {
      capture.parse(msg)
    }

    expect(capture.hasData()).toBe(true)

    const algorithms = capture.getAlgorithms()

    // Verify client (local) algorithms
    expect(algorithms.client.kex).toContain('curve25519-sha256')
    expect(algorithms.client.kex).toContain('diffie-hellman-group14-sha1')
    expect(algorithms.client.serverHostKey).toContain('ssh-ed25519')
    expect(algorithms.client.cipher).toContain('aes256-gcm@openssh.com')
    expect(algorithms.client.mac).toContain('hmac-sha2-256-etm@openssh.com')
    expect(algorithms.client.compress).toContain('none')

    // Verify server (remote) algorithms
    expect(algorithms.server.kex).toContain('diffie-hellman-group14-sha1')
    expect(algorithms.server.kex).not.toContain('curve25519-sha256')
    expect(algorithms.server.serverHostKey).toEqual(['ssh-rsa'])
    expect(algorithms.server.cipher).toContain('aes128-cbc')
    expect(algorithms.server.mac).toContain('hmac-sha1')
    expect(algorithms.server.compress).toEqual(['none'])
  })
})
