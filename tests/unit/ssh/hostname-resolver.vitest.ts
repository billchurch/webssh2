// tests/unit/ssh/hostname-resolver.vitest.ts

import { describe, it, expect, vi } from 'vitest'
import {
  resolveHostname,
  isIpInSubnets,
  validateConnectionWithDns
} from '../../../app/ssh/hostname-resolver.js'
import * as dns from 'node:dns/promises'
import { TEST_IPS, TEST_SUBNETS, TEST_WILDCARDS } from '../../test-constants.js'

// Mock the DNS module
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn()
}))

describe('hostname-resolver', () => {
  describe('resolveHostname', () => {
    it('should recognize IPv4 addresses', async () => {
      const result = await resolveHostname(TEST_IPS.PRIVATE_192_100)

      expect(result).toEqual({
        ok: true,
        value: {
          hostname: TEST_IPS.PRIVATE_192_100,
          addresses: [TEST_IPS.PRIVATE_192_100]
        }
      })
    })

    it('should recognize IPv6 addresses', async () => {
      const result = await resolveHostname(TEST_IPS.DOCUMENTATION_V6)

      expect(result).toEqual({
        ok: true,
        value: {
          hostname: TEST_IPS.DOCUMENTATION_V6,
          addresses: [TEST_IPS.DOCUMENTATION_V6]
        }
      })
    })

    it('should resolve hostnames to IP addresses', async () => {
      const mockLookup = vi.mocked(dns.lookup)
      mockLookup.mockResolvedValue({ address: TEST_IPS.PRIVATE_192, family: 4 })

      const result = await resolveHostname('example.com')

      expect(mockLookup).toHaveBeenCalledWith('example.com')
      expect(result).toEqual({
        ok: true,
        value: {
          hostname: 'example.com',
          addresses: [TEST_IPS.PRIVATE_192]
        }
      })
    })

    it('should handle DNS resolution failures', async () => {
      const mockLookup = vi.mocked(dns.lookup)
      mockLookup.mockRejectedValue(new Error('ENOTFOUND'))

      const result = await resolveHostname('invalid.example.com')

      expect(result).toEqual({
        ok: false,
        error: new Error('DNS resolution failed for invalid.example.com: ENOTFOUND')
      })
    })
  })

  describe('isIpInSubnets', () => {
    it('should allow all IPs when no subnets specified', () => {
      const result = isIpInSubnets(TEST_IPS.PRIVATE_192_100, [])
      expect(result).toBe(true)
    })

    it('should match exact IP addresses', () => {
      const subnets = [TEST_IPS.PRIVATE_192_100, TEST_IPS.PRIVATE_10]

      expect(isIpInSubnets(TEST_IPS.PRIVATE_192_100, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_192_101, subnets)).toBe(false)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_10, subnets)).toBe(true)
    })

    it('should match CIDR /24 notation', () => {
      const subnets = [TEST_SUBNETS.PRIVATE_192]

      expect(isIpInSubnets(TEST_IPS.PRIVATE_192, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_192_254, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_192_2_1, subnets)).toBe(false)
    })

    it('should match CIDR /16 notation', () => {
      const subnets = [TEST_SUBNETS.PRIVATE_192_16]

      expect(isIpInSubnets(TEST_IPS.PRIVATE_192, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_192_255_254, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_169_1_1, subnets)).toBe(false)
    })

    it('should match CIDR /8 notation', () => {
      const subnets = [TEST_SUBNETS.PRIVATE_10]

      expect(isIpInSubnets(TEST_IPS.PRIVATE_10, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_10_ALT, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_11_0_0_1, subnets)).toBe(false)
    })

    it('should match wildcard notation', () => {
      const subnets = [TEST_WILDCARDS.PRIVATE_192_ALL, TEST_WILDCARDS.PRIVATE_10_DOUBLE]

      expect(isIpInSubnets(TEST_IPS.PRIVATE_192, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_192_254, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_192_2_1, subnets)).toBe(false)

      expect(isIpInSubnets(TEST_IPS.PRIVATE_10, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_10_0_255_254, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_10_1_0_1, subnets)).toBe(false)
    })

    it('should handle mixed subnet formats', () => {
      const subnets = [TEST_IPS.PRIVATE_192_100, TEST_SUBNETS.PRIVATE_10_24, TEST_WILDCARDS.PRIVATE_172_ALL]

      expect(isIpInSubnets(TEST_IPS.PRIVATE_192_100, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_10_0_50, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_172, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PUBLIC_DNS, subnets)).toBe(false)
    })

    // IPv6 tests
    it('should match exact IPv6 addresses', () => {
      const subnets = [TEST_IPS.LOCALHOST_V6, TEST_IPS.DOCUMENTATION_V6]

      expect(isIpInSubnets(TEST_IPS.LOCALHOST_V6, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.DOCUMENTATION_V6, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.DOCUMENTATION_V6_ALT, subnets)).toBe(false)
    })

    it('should match IPv6 CIDR /128 notation (single address)', () => {
      const subnets = [TEST_SUBNETS.LOCALHOST_V6]

      expect(isIpInSubnets(TEST_IPS.LOCALHOST_V6, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.LOCALHOST_V6_ALT, subnets)).toBe(false)
    })

    it('should match IPv6 CIDR /64 notation', () => {
      const subnets = [TEST_SUBNETS.DOCUMENTATION_V6_64]

      expect(isIpInSubnets(TEST_IPS.DOCUMENTATION_V6, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.DOCUMENTATION_V6_FFFF, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.DOCUMENTATION_V6_DIFF, subnets)).toBe(false)
    })

    it('should match IPv6 CIDR /32 notation', () => {
      const subnets = [TEST_SUBNETS.DOCUMENTATION_V6]

      expect(isIpInSubnets(TEST_IPS.DOCUMENTATION_V6_SUBNET, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.DOCUMENTATION_V6_SUBNET_ALT, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.DOCUMENTATION_V6_DIFF, subnets)).toBe(false)
    })

    it('should handle mixed IPv4 and IPv6 subnets', () => {
      const subnets = [TEST_SUBNETS.LOCALHOST, TEST_SUBNETS.LOCALHOST_V6]

      expect(isIpInSubnets(TEST_IPS.LOCALHOST, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.LOCALHOST_100, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.LOCALHOST_V6, subnets)).toBe(true)
      expect(isIpInSubnets(TEST_IPS.PRIVATE_192, subnets)).toBe(false)
      expect(isIpInSubnets(TEST_IPS.LOCALHOST_V6_ALT, subnets)).toBe(false)
    })
  })

  describe('validateConnectionWithDns', () => {
    it('should allow all connections when no subnets specified', async () => {
      const result = await validateConnectionWithDns('example.com')

      expect(result).toEqual({
        ok: true,
        value: true
      })
    })

    it('should allow all connections when empty subnets array', async () => {
      const result = await validateConnectionWithDns('example.com', [])

      expect(result).toEqual({
        ok: true,
        value: true
      })
    })

    it('should validate IP addresses against subnets', async () => {
      const subnets = [TEST_SUBNETS.PRIVATE_192]

      const result1 = await validateConnectionWithDns(TEST_IPS.PRIVATE_192_100, subnets)
      expect(result1).toEqual({
        ok: true,
        value: true
      })

      const result2 = await validateConnectionWithDns(TEST_IPS.PRIVATE_192_2_100, subnets)
      expect(result2).toEqual({
        ok: true,
        value: false
      })
    })

    it('should resolve hostnames and validate against subnets', async () => {
      const mockLookup = vi.mocked(dns.lookup)
      mockLookup.mockResolvedValue({ address: TEST_IPS.PRIVATE_192, family: 4 })

      const subnets = [TEST_SUBNETS.PRIVATE_192]
      const result = await validateConnectionWithDns('example.com', subnets)

      expect(mockLookup).toHaveBeenCalledWith('example.com')
      expect(result).toEqual({
        ok: true,
        value: true
      })
    })

    it('should reject hostnames not in allowed subnets', async () => {
      const mockLookup = vi.mocked(dns.lookup)
      mockLookup.mockResolvedValue({ address: TEST_IPS.PUBLIC_DNS, family: 4 })

      const subnets = [TEST_SUBNETS.PRIVATE_192]
      const result = await validateConnectionWithDns('google-dns.com', subnets)

      expect(result).toEqual({
        ok: true,
        value: false
      })
    })

    it('should handle DNS resolution failures', async () => {
      const mockLookup = vi.mocked(dns.lookup)
      mockLookup.mockRejectedValue(new Error('ENOTFOUND'))

      const subnets = [TEST_SUBNETS.PRIVATE_192]
      const result = await validateConnectionWithDns('invalid.example.com', subnets)

      expect(result).toEqual({
        ok: false,
        error: new Error('DNS resolution failed for invalid.example.com: ENOTFOUND')
      })
    })
  })
})