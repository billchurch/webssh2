// app/services/ssh/algorithm-capture.ts
// Pure functions for capturing SSH algorithm information from ssh2 debug messages

/**
 * Set of algorithms for a specific direction (client or server)
 */
export interface AlgorithmSet {
  kex: string[]
  serverHostKey: string[]
  cipher: string[]
  mac: string[]
  compress: string[]
}

/**
 * Captured algorithms from both client and server during SSH handshake
 */
export interface CapturedAlgorithms {
  client: AlgorithmSet
  server: AlgorithmSet
}

/**
 * Result of parsing an algorithm debug message
 */
export interface AlgorithmParseResult {
  source: 'local' | 'remote'
  category: keyof AlgorithmSet
  algorithms: string[]
}

/**
 * Algorithm capture instance for accumulating parsed messages
 */
export interface AlgorithmCapture {
  parse: (msg: string) => void
  getAlgorithms: () => CapturedAlgorithms
  hasData: () => boolean
}

/**
 * Create an empty algorithm set
 */
export const createEmptyAlgorithmSet = (): AlgorithmSet => ({
  kex: [],
  serverHostKey: [],
  cipher: [],
  mac: [],
  compress: []
})

/**
 * Create empty captured algorithms structure
 */
export const createEmptyCapturedAlgorithms = (): CapturedAlgorithms => ({
  client: createEmptyAlgorithmSet(),
  server: createEmptyAlgorithmSet()
})

/**
 * Parse a single ssh2 debug message to extract algorithm information.
 *
 * ssh2 emits messages like:
 * - "Handshake: (local) KEX method: curve25519-sha256,ecdh-sha2-nistp256,..."
 * - "Handshake: (remote) KEX method: diffie-hellman-group14-sha1,..."
 * - "Handshake: (local) Host key format: ssh-ed25519,rsa-sha2-512,..."
 * - "Handshake: (remote) Host key format: ssh-rsa,..."
 * - "Handshake: (local) C->S cipher: aes256-gcm@openssh.com,..."
 * - "Handshake: (remote) C->S cipher: aes128-cbc,..."
 * - "Handshake: (local) C->S MAC: hmac-sha2-256-etm@openssh.com,..."
 * - "Handshake: (remote) C->S MAC: hmac-sha1,..."
 * - "Handshake: (local) C->S compression: none,zlib@openssh.com,..."
 * - "Handshake: (remote) C->S compression: none,..."
 *
 * @param msg - Debug message from ssh2
 * @returns Parsed result or null if message doesn't contain algorithm info
 * @pure
 */
export const parseAlgorithmDebugMessage = (msg: string): AlgorithmParseResult | null => {
  // Check if this is a handshake message
  if (!msg.startsWith('Handshake: (')) {
    return null
  }

  // Extract source (local = client, remote = server)
  const sourceMatch = /^Handshake: \((local|remote)\)/.exec(msg)
  if (sourceMatch === null) {
    return null
  }
  const source = sourceMatch[1] as 'local' | 'remote'

  // Extract category and algorithms
  const categoryResult = extractCategory(msg)
  if (categoryResult === null) {
    return null
  }

  const { category, algorithmsString } = categoryResult

  // Parse algorithm list (comma-separated)
  const algorithms = algorithmsString
    .split(',')
    .map(alg => alg.trim())
    .filter(alg => alg !== '')

  if (algorithms.length === 0) {
    return null
  }

  return { source, category, algorithms }
}

/**
 * Extract category and algorithms string from debug message
 */
const extractCategory = (msg: string): { category: keyof AlgorithmSet, algorithmsString: string } | null => {
  // KEX method
  const kexMatch = /KEX method: (.+)$/.exec(msg)
  if (kexMatch?.[1] !== undefined) {
    return { category: 'kex', algorithmsString: kexMatch[1] }
  }

  // Host key format
  const hostKeyMatch = /Host key format: (.+)$/.exec(msg)
  if (hostKeyMatch?.[1] !== undefined) {
    return { category: 'serverHostKey', algorithmsString: hostKeyMatch[1] }
  }

  // Cipher (C->S = Client->Server, we only need one direction)
  // ssh2 uses abbreviated form: "C->S cipher:" not "Client->Server cipher:"
  const cipherMatch = /C->S cipher: (.+)$/.exec(msg)
  if (cipherMatch?.[1] !== undefined) {
    return { category: 'cipher', algorithmsString: cipherMatch[1] }
  }

  // MAC
  const macMatch = /C->S MAC: (.+)$/.exec(msg)
  if (macMatch?.[1] !== undefined) {
    return { category: 'mac', algorithmsString: macMatch[1] }
  }

  // Compression
  const compressMatch = /C->S compression: (.+)$/.exec(msg)
  if (compressMatch?.[1] !== undefined) {
    return { category: 'compress', algorithmsString: compressMatch[1] }
  }

  return null
}

/**
 * Create an algorithm capture instance for accumulating parsed debug messages.
 *
 * @returns Algorithm capture instance with parse, getAlgorithms, and hasData methods
 */
export const createAlgorithmCapture = (): AlgorithmCapture => {
  const captured: CapturedAlgorithms = createEmptyCapturedAlgorithms()
  let dataReceived = false

  return {
    parse: (msg: string): void => {
      const result = parseAlgorithmDebugMessage(msg)
      if (result === null) {
        return
      }

      dataReceived = true
      const target = result.source === 'local' ? captured.client : captured.server

      // Only set if not already populated (first occurrence wins)
      if (target[result.category].length === 0) {
        target[result.category] = result.algorithms
      }
    },

    getAlgorithms: (): CapturedAlgorithms => ({
      client: { ...captured.client },
      server: { ...captured.server }
    }),

    hasData: (): boolean => dataReceived
  }
}

/**
 * Check if an algorithm set has any data
 */
export const hasAlgorithmData = (set: AlgorithmSet): boolean => {
  return (
    set.kex.length > 0 ||
    set.serverHostKey.length > 0 ||
    set.cipher.length > 0 ||
    set.mac.length > 0 ||
    set.compress.length > 0
  )
}
