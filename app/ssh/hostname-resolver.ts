// app/ssh/hostname-resolver.ts
// Async hostname resolution service for subnet validation

import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import { isIP } from 'node:net'
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

    const ipVersion = isIP(hostname)

    if (ipVersion === 4 || ipVersion === 6) {
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
    const lookupResult = await lookup(hostname, { all: true })
    const entries: Array<LookupAddress | string> = Array.isArray(lookupResult)
      ? lookupResult
      : [lookupResult]

    const addresses = entries
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry
        }
        return entry.address
      })
      .filter((address): address is string => typeof address === 'string' && address !== '')

    if (addresses.length === 0) {
      return {
        ok: false,
        error: new Error(`No DNS records found for ${hostname}`)
      }
    }

    debug(`Resolved ${hostname} to ${addresses.join(', ')}`)

    return {
      ok: true,
      value: {
        hostname,
        addresses
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

  const mask = Number.parseInt(maskStr, 10)
  if (Number.isNaN(mask) || mask < 0 || mask > 32) {
    return false
  }

  // Convert IP addresses to 32-bit integers
  const ipToInt = (addr: string): number => {
    const parts = addr.split('.')
    if (parts.length !== 4) {
      return 0
    }
    return parts.reduce((acc, part, i) => {
      const num = Number.parseInt(part, 10)
      if (Number.isNaN(num) || num < 0 || num > 255) {
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

  const mask = Number.parseInt(maskStr, 10)
  if (Number.isNaN(mask) || mask < 0 || mask > 128) {
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

  const ipPartMap = new Map(ipParts.entries())
  const subnetPartMap = new Map(subnetParts.entries())

  const segmentIndices: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7]

  let bitsChecked = 0
  for (const index of segmentIndices) {
    if (bitsChecked >= mask) {
      break
    }

    const ipPart = ipPartMap.get(index) ?? '0'
    const subnetPart = subnetPartMap.get(index) ?? '0'
    const ipHex = Number.parseInt(ipPart, 16)
    const subnetHex = Number.parseInt(subnetPart, 16)

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

  const ipOctets = ip.split('.')
  const subnetOctets = subnet.split('.')
  if (ipOctets.length !== 4 || subnetOctets.length !== 4) {
    return false
  }

  const ipOctetMap = new Map(ipOctets.entries())

  for (const [index, subnetOctet] of subnetOctets.entries()) {
    if (subnetOctet === '*') {
      continue
    }

    const ipOctet = ipOctetMap.get(index)
    if (ipOctet == null || subnetOctet !== ipOctet) {
      return false
    }
  }

  return true
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
  const version = isIP(ip)
  return {
    isIpv4: version === 4,
    isIpv6: version === 6
  }
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

  if (resolveResult.ok) {
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
  } else {
    return {
      ok: false,
      error: resolveResult.error
    }
  }
}
