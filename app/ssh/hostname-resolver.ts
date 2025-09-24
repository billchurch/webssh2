// app/ssh/hostname-resolver.ts
// Async hostname resolution service for subnet validation

import { lookup } from 'node:dns/promises'
import type { Result } from '../types/result.js'
import { createNamespacedDebug } from '../logger.js'

const debug = createNamespacedDebug('ssh:hostname-resolver')

export interface ResolvedHost {
  hostname: string
  addresses: string[]
}

/**
 * Resolve hostname to IP addresses
 * Performs async DNS lookup
 */
export const resolveHostname = async (
  hostname: string
): Promise<Result<ResolvedHost>> => {
  try {
    debug(`Resolving hostname: ${hostname}`)

    // Check if already an IP address
    // eslint-disable-next-line security/detect-unsafe-regex
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
    // eslint-disable-next-line security/detect-unsafe-regex
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

    if (ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)) {
      debug(`${hostname} is already an IP address`)
      return {
        ok: true,
        value: {
          hostname,
          addresses: [hostname]
        }
      }
    }

    // Perform DNS lookup
    const { address } = await lookup(hostname)

    debug(`Resolved ${hostname} to ${address}`)

    return {
      ok: true,
      value: {
        hostname,
        addresses: [address]
      }
    }
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Failed to resolve hostname'

    debug(`Failed to resolve ${hostname}: ${message}`)

    return {
      ok: false,
      error: new Error(`DNS resolution failed for ${hostname}: ${message}`)
    }
  }
}

/**
 * Check if an IPv4 address matches a subnet in CIDR notation
 */
const isIpv4InCidr = (ip: string, subnet: string): boolean => {
  const [subnetBase, maskStr] = subnet.split('/')
  if (subnetBase === undefined || maskStr === undefined) {
    return false
  }

  const mask = parseInt(maskStr, 10)
  if (isNaN(mask) || mask < 0 || mask > 32) {
    return false
  }

  // Convert IP addresses to 32-bit integers
  const ipToInt = (addr: string): number => {
    const parts = addr.split('.')
    if (parts.length !== 4) {
      return 0
    }
    return parts.reduce((acc, part, i) => {
      const num = parseInt(part, 10)
      if (isNaN(num) || num < 0 || num > 255) {
        return 0
      }
      return acc + (num << (8 * (3 - i)))
    }, 0)
  }

  const ipInt = ipToInt(ip)
  const subnetInt = ipToInt(subnetBase)
  const maskBits = (0xFFFFFFFF << (32 - mask)) >>> 0

  return (ipInt & maskBits) === (subnetInt & maskBits)
}

/**
 * Check if an IPv6 address matches a subnet in CIDR notation
 */
const isIpv6InCidr = (ip: string, subnet: string): boolean => {
  const [subnetBase, maskStr] = subnet.split('/')
  if (subnetBase === undefined || maskStr === undefined) {
    return false
  }

  const mask = parseInt(maskStr, 10)
  if (isNaN(mask) || mask < 0 || mask > 128) {
    return false
  }

  // Normalize IPv6 addresses
  const normalizeIpv6 = (addr: string): string => {
    // Expand :: notation
    if (addr.includes('::')) {
      const parts = addr.split('::')
      const left = parts[0]?.split(':').filter(p => p !== '') ?? []
      const right = parts[1]?.split(':').filter(p => p !== '') ?? []
      const missing = 8 - left.length - right.length
      const middle: string[] = Array(missing).fill('0') as string[]
      const expanded = [...left, ...middle, ...right]
      return expanded.map(p => p.padStart(4, '0')).join(':')
    }
    // Already expanded, just pad
    return addr.split(':').map(p => p.padStart(4, '0')).join(':')
  }

  const normalizedIp = normalizeIpv6(ip.toLowerCase())
  const normalizedSubnet = normalizeIpv6(subnetBase.toLowerCase())

  // Convert to binary and compare based on mask
  const ipParts = normalizedIp.split(':')
  const subnetParts = normalizedSubnet.split(':')

  let bitsChecked = 0
  for (let i = 0; i < 8 && bitsChecked < mask; i++) {
    // eslint-disable-next-line security/detect-object-injection
    const ipPart = ipParts[i] ?? '0'
    // eslint-disable-next-line security/detect-object-injection
    const subnetPart = subnetParts[i] ?? '0'
    const ipHex = parseInt(ipPart, 16)
    const subnetHex = parseInt(subnetPart, 16)

    const bitsToCheck = Math.min(16, mask - bitsChecked)
    const bitMask = (0xFFFF << (16 - bitsToCheck)) & 0xFFFF

    if ((ipHex & bitMask) !== (subnetHex & bitMask)) {
      return false
    }

    bitsChecked += 16
  }

  return true
}

/**
 * Check if IP matches exact subnet
 */
const matchesExactIp = (ip: string, subnet: string): boolean => {
  return subnet === ip
}

/**
 * Check if IPv4 matches wildcard notation
 */
const matchesIpv4Wildcard = (ip: string, subnet: string): boolean => {
  if (!subnet.includes('*')) {
    return false
  }

  const pattern = subnet.replace(/\./g, '\\.').replace(/\*/g, '.*')
  // eslint-disable-next-line security/detect-non-literal-regexp
  const regex = new RegExp(`^${pattern}$`)
  return regex.test(ip)
}

/**
 * Check if IP matches CIDR subnet
 */
const matchesCidrSubnet = (
  ip: string,
  subnet: string,
  isIpv4: boolean,
  isIpv6: boolean
): boolean => {
  if (!subnet.includes('/')) {
    return false
  }

  if (isIpv4 && subnet.includes('.')) {
    return isIpv4InCidr(ip, subnet)
  }

  if (isIpv6 && subnet.includes(':')) {
    return isIpv6InCidr(ip, subnet)
  }

  return false
}

/**
 * Determine IP version
 */
const getIpVersion = (ip: string): { isIpv4: boolean; isIpv6: boolean } => {
  // eslint-disable-next-line security/detect-unsafe-regex
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)
  // eslint-disable-next-line security/detect-unsafe-regex
  const isIpv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip)

  return { isIpv4, isIpv6 }
}

/**
 * Check if an IP address is in allowed subnets
 * Pure function for IP validation
 */
export const isIpInSubnets = (
  ip: string,
  allowedSubnets: string[]
): boolean => {
  if (allowedSubnets.length === 0) {
    return true // No restrictions
  }

  const { isIpv4, isIpv6 } = getIpVersion(ip)

  for (const subnet of allowedSubnets) {
    if (matchesExactIp(ip, subnet)) {
      return true
    }

    if (matchesCidrSubnet(ip, subnet, isIpv4, isIpv6)) {
      return true
    }

    if (isIpv4 && matchesIpv4Wildcard(ip, subnet)) {
      return true
    }
  }

  return false
}

/**
 * Validate connection with hostname resolution
 * Async function that resolves hostnames and checks subnets
 */
export const validateConnectionWithDns = async (
  host: string,
  allowedSubnets?: string[]
): Promise<Result<boolean>> => {
  // No restrictions if allowedSubnets is not configured
  if (allowedSubnets == null || allowedSubnets.length === 0) {
    debug(`No subnet restrictions for ${host}`)
    return { ok: true, value: true }
  }

  // Resolve hostname to IP
  const resolveResult = await resolveHostname(host)

  if (!resolveResult.ok) {
    return {
      ok: false,
      error: resolveResult.error
    }
  }

  // Check if any resolved IP is in allowed subnets
  const { addresses } = resolveResult.value

  for (const ip of addresses) {
    if (isIpInSubnets(ip, allowedSubnets)) {
      debug(`${host} (${ip}) is in allowed subnets`)
      return { ok: true, value: true }
    }
  }

  debug(`${host} (${addresses.join(', ')}) is not in allowed subnets`)
  return {
    ok: true,
    value: false
  }
}