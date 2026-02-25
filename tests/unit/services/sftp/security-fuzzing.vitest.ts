/**
 * Security Fuzzing Tests for Shell File Backend
 *
 * Verifies the three defense layers that protect against command injection
 * when user-supplied filenames/paths are interpolated into shell commands:
 *
 * 1. validateFileName() - rejects null bytes, separators, reserved names, length
 * 2. validatePath()     - rejects null bytes, traversal, length, forbidden paths
 * 3. escapeShellPath()  - single-quote wrapping with '\'' escaping
 *
 * The key technique is a real shell round-trip: execute `printf '%s' <escaped>`
 * through /bin/sh and verify the output matches the original input byte-for-byte.
 * If it does, the escaping is provably correct — no injection is possible.
 *
 * NOTE: Standalone validateFileName and validatePath tests live in
 * path-validator.vitest.ts. This file focuses on escapeShellPath round-trips
 * and the defense-in-depth chain (validator + escaping together).
 *
 * @module tests/unit/services/sftp/security-fuzzing
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import {
  validateFileName,
  validatePath,
} from '../../../../app/services/sftp/path-validator.js'
import { escapeShellPath } from '../../../../app/services/sftp/shell-commands.js'

// =============================================================================
// Helpers
// =============================================================================

/** Default path validation options: allow all paths, no blocked extensions */
const PERMISSIVE_OPTIONS = {
  allowedPaths: null,
  blockedExtensions: [],
  checkExtension: false,
} as const

/**
 * Execute the escaped string through a real /bin/sh and return stdout.
 *
 * SAFETY: The only command executed is `printf '%s'`, which merely prints.
 * Attack strings are data, never commands. Even if escaping were completely
 * broken, printf cannot execute subcommands.
 */
function shellRoundTrip(input: string): string {
  const escaped = escapeShellPath(input)
  return execSync(`printf '%s' ${escaped}`, { //NOSONAR - intentional shell exec to verify escapeShellPath correctness; input is hardcoded test constants
    encoding: 'utf-8',
    shell: '/bin/sh',
    timeout: 5000,
  })
}

/**
 * Assert that escapeShellPath produces a correct round-trip through /bin/sh.
 */
function expectShellSafe(input: string): void {
  const output = shellRoundTrip(input)
  expect(output).toBe(input)
}

/**
 * Assert that validateFileName rejects the input
 */
function expectFileNameRejected(input: string): void {
  const result = validateFileName(input)
  expect(result.ok).toBe(false)
}

/**
 * Assert that validateFileName accepts the input
 */
function expectFileNameAccepted(input: string): void {
  const result = validateFileName(input)
  expect(result.ok).toBe(true)
}

/**
 * Assert that validatePath rejects the input (using PERMISSIVE_OPTIONS)
 */
function expectPathRejected(input: string): void {
  const result = validatePath(input, PERMISSIVE_OPTIONS)
  expect(result.ok).toBe(false)
}

/**
 * Generate shell-safety round-trip tests for an array of { input, desc } cases.
 * Each case verifies that escapeShellPath round-trips correctly through /bin/sh.
 */
function shellSafeSuite(
  name: string,
  cases: ReadonlyArray<{ readonly input: string; readonly desc: string }>,
): void {
  describe(name, () => {
    for (const { input, desc } of cases) {
      it(`handles ${desc}`, () => {
        expectShellSafe(input)
      })
    }
  })
}

// =============================================================================
// escapeShellPath round-trip fuzzing
// =============================================================================

describe('escapeShellPath round-trip fuzzing', () => {
  // ---------------------------------------------------------------------------
  // Shell injection vectors
  // ---------------------------------------------------------------------------
  describe('shell injection vectors', () => {
    const injectionVectors = [
      "'; rm -rf / #",
      "'; cat /etc/passwd #",
      '$(whoami)',
      '$(cat /etc/passwd)',
      '`id`',
      '`uname -a`',
      '| cat /etc/passwd',
      '|| echo pwned',
      '&& echo pwned',
      '; echo pwned',
      '> /tmp/pwned',
      '>> /tmp/pwned',
      '< /etc/passwd',
      '$((1+1))',
      // eslint-disable-next-line no-template-curly-in-string
      '${HOME}',
      '$HOME',
      '$PATH',
    ]

    for (const vector of injectionVectors) {
      it(`neutralizes: ${JSON.stringify(vector)}`, () => {
        expectShellSafe(vector)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Single quote edge cases
  // ---------------------------------------------------------------------------
  shellSafeSuite('single quote edge cases', [
    { input: "'", desc: 'single quote alone' },
    { input: "''", desc: 'double single quote' },
    { input: "'''", desc: 'triple single quote' },
    { input: "'hello", desc: 'single quote at start' },
    { input: "hello'", desc: 'single quote at end' },
    { input: "'hello'", desc: 'single quotes surrounding text' },
    { input: String.raw`'\''`, desc: 'nested quote escape pattern' },
    { input: String.raw`'\''$(id)'\''`, desc: 'injection via quote escape confusion' },
    { input: "a'b'c'd'e", desc: 'alternating quotes and text' },
  ])

  // ---------------------------------------------------------------------------
  // Double quote and mixed quoting
  // ---------------------------------------------------------------------------
  shellSafeSuite('double quotes and mixed quoting', [
    { input: '"hello world"', desc: 'double quotes' },
    { input: 'he said "it\'s fine"', desc: 'mixed single and double quotes' },
    { input: String.raw`\"`, desc: 'backslash-double-quote combo' },
    { input: '"$HOME"', desc: 'dollar-in-double-quotes' },
  ])

  // ---------------------------------------------------------------------------
  // Special characters
  // ---------------------------------------------------------------------------
  shellSafeSuite('special characters', [
    { input: 'hello world', desc: 'spaces' },
    { input: 'hello\tworld', desc: 'tabs' },
    { input: 'hello\nworld', desc: 'newlines' },
    { input: 'hello\rworld', desc: 'carriage returns' },
    { input: String.raw`hello\world`, desc: 'backslashes' },
    { input: '\\\\\\', desc: 'multiple backslashes' },
    { input: '*.txt', desc: 'asterisks (glob)' },
    { input: 'file?.txt', desc: 'question marks (glob)' },
    { input: 'file[0-9].txt', desc: 'square brackets (glob)' },
    { input: '{a,b,c}', desc: 'curly braces (brace expansion)' },
    { input: '~', desc: 'tilde (home expansion)' },
    { input: '# this is a comment', desc: 'hash (comment)' },
    { input: '!!', desc: 'exclamation mark (history expansion)' },
    { input: '&', desc: 'ampersand' },
    { input: '(subshell)', desc: 'parentheses (subshell)' },
  ])

  // ---------------------------------------------------------------------------
  // Control characters
  // ---------------------------------------------------------------------------
  shellSafeSuite('control characters', [
    { input: '\x07', desc: 'bell character' },
    { input: '\x08', desc: 'backspace' },
    { input: '\x0B', desc: 'vertical tab' },
    { input: '\x0C', desc: 'form feed' },
    { input: '\x1B', desc: 'escape character' },
    { input: '\x1B[31mred\x1B[0m', desc: 'ANSI escape sequence' },
    { input: '\x7F', desc: 'DEL character' },
  ])

  // ---------------------------------------------------------------------------
  // Unicode
  // ---------------------------------------------------------------------------
  shellSafeSuite('unicode', [
    { input: '\u202E', desc: 'RTL override character' },
    { input: '\uFEFF', desc: 'BOM' },
    { input: '\u200B', desc: 'zero-width space' },
    { input: '\u200D', desc: 'zero-width joiner' },
    { input: '\u0430', desc: 'homoglyph: Cyrillic а (looks like Latin a)' },
    { input: 'file_\uD83D\uDE00.txt', desc: 'emoji' },
    { input: '文件.txt', desc: 'CJK characters' },
    { input: 'file\u0301.txt', desc: 'combining diacritical marks' },
  ])

  // ---------------------------------------------------------------------------
  // Boundary conditions
  // ---------------------------------------------------------------------------
  shellSafeSuite('boundary conditions', [
    { input: '', desc: 'empty string' },
    { input: 'a', desc: 'single character' },
    { input: '   ', desc: 'whitespace-only string' },
    { input: 'a'.repeat(1000), desc: 'long string (1000 chars)' },
    { input: "'''''", desc: 'string of all single quotes' },
    { input: "important_doc'; DROP TABLE users;--.pdf", desc: 'realistic malicious filename' },
  ])

  // ---------------------------------------------------------------------------
  // Flag injection (cat/ls argument abuse)
  // ---------------------------------------------------------------------------
  shellSafeSuite('flag injection', [
    { input: '--help', desc: '--help as path' },
    { input: '-rf', desc: '-rf as path' },
    { input: '--version', desc: '--version as path' },
    { input: '-e exec', desc: '-e with command as path' },
  ])
})

// =============================================================================
// Defense-in-depth: full chain tests
// =============================================================================

describe('defense-in-depth: validator + escaping chain', () => {
  // ---------------------------------------------------------------------------
  // Inputs rejected by validators (first line of defense)
  // ---------------------------------------------------------------------------
  describe('inputs rejected by validators', () => {
    const rejectedByFileName = [
      { input: 'file\0.txt', reason: 'null byte' },
      { input: '../../../etc/passwd', reason: 'path traversal in filename' },
      { input: '/', reason: 'slash in filename' },
      { input: '.', reason: 'reserved name (dot)' },
      { input: '..', reason: 'reserved name (dotdot)' },
      { input: 'a'.repeat(256), reason: 'exceeds max filename length' },
    ]

    for (const { input, reason } of rejectedByFileName) {
      it(`validateFileName rejects: ${reason}`, () => {
        expectFileNameRejected(input)
      })
    }

    const rejectedByPath = [
      { input: '/home/user/\0file', reason: 'null byte in path' },
      { input: '../secret', reason: 'relative traversal' },
      { input: `/${'x'.repeat(4096)}`, reason: 'exceeds max path length' },
    ]

    for (const { input, reason } of rejectedByPath) {
      it(`validatePath rejects: ${reason}`, () => {
        expectPathRejected(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Sneaky inputs that pass validators but are shell-safe via escaping
  // ---------------------------------------------------------------------------
  describe('inputs that pass validators but are shell-safe', () => {
    // These filenames have no null bytes, no path separators, and aren't reserved
    // names — so validateFileName accepts them. But they contain shell
    // metacharacters that would be dangerous without escaping.
    const sneakyFileNames = [
      '$(whoami)',
      '`id`',
      '&& echo pwned',
      '; echo pwned',
      '--help',
      '-rf',
      "it's a trap",
      '$HOME',
      // eslint-disable-next-line no-template-curly-in-string
      '${PATH}',
      'file\nname',
      'file\ttab',
      '\x1B[31mred_alert\x1B[0m',
      '\u202Efdp.exe',
    ]

    for (const name of sneakyFileNames) {
      it(`fileName+escape chain is safe for: ${JSON.stringify(name)}`, () => {
        // These pass filename validation (no null bytes, separators, or reserved names)
        expectFileNameAccepted(name)
        // But escapeShellPath makes them shell-safe
        expectShellSafe(name)
      })
    }

    // These contain `/` so validateFileName rejects them outright —
    // they never even reach the shell escaping layer
    const rejectedBySlash = [
      "'; rm -rf / #",
      '| cat /etc/passwd',
      '$(cat /etc/shadow)',
    ]

    for (const name of rejectedBySlash) {
      it(`fileName rejects slash-containing attack: ${JSON.stringify(name)}`, () => {
        expectFileNameRejected(name)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Full path chain: validatePath then escapeShellPath
  // ---------------------------------------------------------------------------
  describe('full path chain: validatePath + escapeShellPath', () => {
    const sneakyPaths = [
      "/home/user/'; rm -rf / #",
      '/home/user/$(whoami)',
      '/home/user/`id`',
      '/home/user/| cat /etc/passwd',
      '/home/user/$HOME',
      "/home/user/it's my file",
      '/home/user/file name with spaces',
      '/home/user/--help',
      '/home/user/\ttab',
      '/home/user/\u202Efdp.exe',
    ]

    for (const path of sneakyPaths) {
      it(`path chain is safe for: ${JSON.stringify(path)}`, () => {
        const pathResult = validatePath(path, PERMISSIVE_OPTIONS)
        expect(pathResult.ok).toBe(true)

        // The path that comes out of validatePath (normalized) is what
        // gets passed to escapeShellPath in production
        if (pathResult.ok) {
          expectShellSafe(pathResult.value)
        }
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Restricted mode: allowed paths + shell safety
  // ---------------------------------------------------------------------------
  describe('restricted mode: allowed paths + shell safety', () => {
    const restrictedOptions = {
      allowedPaths: ['/home/user'],
      blockedExtensions: ['.exe'],
      checkExtension: true,
    } as const

    it('allows safe file within allowed path', () => {
      const result = validatePath('/home/user/document.txt', restrictedOptions)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expectShellSafe(result.value)
      }
    })

    it('blocks traversal out of allowed path', () => {
      const result = validatePath('/home/user/../../etc/passwd', restrictedOptions)
      expect(result.ok).toBe(false)
    })

    it('blocks blocked extension within allowed path', () => {
      const result = validatePath('/home/user/malware.exe', restrictedOptions)
      expect(result.ok).toBe(false)
    })

    it('allows file with shell chars in allowed path', () => {
      const result = validatePath("/home/user/my 'special' file.txt", restrictedOptions)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expectShellSafe(result.value)
      }
    })

    it('rejects injection attempt that tries to escape allowed path', () => {
      const result = validatePath("/home/user/../admin/'; rm -rf /", restrictedOptions)
      expect(result.ok).toBe(false)
    })
  })
})
