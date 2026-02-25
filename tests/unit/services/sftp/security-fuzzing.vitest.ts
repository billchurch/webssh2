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
 * @module tests/unit/services/sftp/security-fuzzing
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import {
  validateFileName,
  validatePath,
} from '../../../../app/services/sftp/path-validator.js'
import { escapeShellPath } from '../../../../app/services/sftp/shell-commands.js'
import { SFTP_LIMITS } from '../../../../app/constants/sftp.js'

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

// =============================================================================
// validateFileName fuzzing
// =============================================================================

describe('validateFileName fuzzing', () => {
  // ---------------------------------------------------------------------------
  // Null byte injection
  // ---------------------------------------------------------------------------
  describe('null byte injection', () => {
    const cases = [
      { input: '\0file.txt', desc: 'at start' },
      { input: 'file\0.txt', desc: 'in middle' },
      { input: 'file.txt\0', desc: 'at end' },
      { input: '\0\0\0', desc: 'multiple null bytes' },
      { input: 'safe.txt\0.exe', desc: 'disguised with extension truncation' },
    ]

    for (const { input, desc } of cases) {
      it(`rejects null byte ${desc}`, () => {
        expectFileNameRejected(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Path separator injection
  // ---------------------------------------------------------------------------
  describe('path separator injection', () => {
    const cases = [
      { input: 'etc/passwd', desc: 'forward slash' },
      { input: String.raw`etc\passwd`, desc: 'backslash' },
      { input: '/etc', desc: 'forward slash at start' },
      { input: String.raw`foo/bar\baz`, desc: 'mixed separators' },
      { input: '../../../etc/passwd', desc: 'traversal attempt in filename' },
    ]

    for (const { input, desc } of cases) {
      it(`rejects ${desc}`, () => {
        expectFileNameRejected(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Reserved names
  // ---------------------------------------------------------------------------
  describe('reserved names', () => {
    const cases = [
      { input: '.', desc: 'single dot' },
      { input: '..', desc: 'double dot' },
    ]

    for (const { input, desc } of cases) {
      it(`rejects ${desc}`, () => {
        expectFileNameRejected(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Length boundaries
  // ---------------------------------------------------------------------------
  describe('length boundaries', () => {
    it('accepts filename at exactly max length (255)', () => {
      const name = 'a'.repeat(SFTP_LIMITS.MAX_FILENAME_LENGTH)
      expectFileNameAccepted(name)
    })

    const rejectedLengths = [
      { length: SFTP_LIMITS.MAX_FILENAME_LENGTH + 1, desc: 'one char over max length (256)' },
      { length: 10_000, desc: 'very long filename (10000 chars)' },
    ]

    for (const { length, desc } of rejectedLengths) {
      it(`rejects filename ${desc}`, () => {
        expectFileNameRejected('a'.repeat(length))
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Control characters and unicode
  // ---------------------------------------------------------------------------
  describe('control characters and unicode', () => {
    // NOTE: validateFileName currently allows these. These tests document
    // that behavior so we can decide if stricter validation is warranted.
    const acceptedCases = [
      { input: 'file\tname.txt', desc: 'tab' },
      { input: 'file\nname.txt', desc: 'newline' },
      { input: 'file\rname.txt', desc: 'carriage return' },
      { input: 'file\x07name.txt', desc: 'bell character' },
      { input: 'file\x1B[31mname.txt', desc: 'ANSI escape' },
      { input: 'file\u202Ename.txt', desc: 'RTL override' },
      { input: 'file\u200Bname.txt', desc: 'zero-width space' },
      { input: '\uFEFFfile.txt', desc: 'BOM' },
    ]

    for (const { input, desc } of acceptedCases) {
      it(`accepts filename with ${desc} (documents current behavior)`, () => {
        expectFileNameAccepted(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Shell metacharacters in filenames
  // ---------------------------------------------------------------------------
  describe('shell metacharacters in filenames', () => {
    // These should be accepted by validateFileName (they're valid filenames)
    // but must be properly escaped before reaching the shell

    // Filenames without path separators: should be accepted
    const acceptedMetaNames = [
      'file$(whoami)',
      'file`id`',
      'file && echo pwned',
      'file || echo pwned',
      '--help',
      '-rf *',
      'file; echo pwned',
      '$(whoami)',
    ]

    for (const name of acceptedMetaNames) {
      it(`accepts shell metacharacter filename: ${JSON.stringify(name)}`, () => {
        expectFileNameAccepted(name)
      })
    }

    // Filenames WITH path separators: correctly rejected by validateFileName
    // (the `/` triggers the path separator check — this is a security win)
    const rejectedMetaNames = [
      "file; rm -rf /",
      'file | cat /etc/passwd',
      'file > /dev/null',
      'file < /dev/null',
      '-rf /tmp/*',
    ]

    for (const name of rejectedMetaNames) {
      it(`rejects filename with slash in shell metachar: ${JSON.stringify(name)}`, () => {
        expectFileNameRejected(name)
      })
    }
  })
})

// =============================================================================
// validatePath fuzzing
// =============================================================================

describe('validatePath fuzzing', () => {
  // ---------------------------------------------------------------------------
  // Null byte injection
  // ---------------------------------------------------------------------------
  describe('null byte injection', () => {
    const cases = [
      { input: '\0/home/user', desc: 'at start of path' },
      { input: '/home/\0user', desc: 'in middle of path' },
      { input: '/home/user\0', desc: 'at end of path' },
      { input: '/home/user/safe.txt\0.exe', desc: 'as extension truncation' },
    ]

    for (const { input, desc } of cases) {
      it(`rejects null byte ${desc}`, () => {
        expectPathRejected(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Path traversal variants
  // ---------------------------------------------------------------------------
  describe('path traversal', () => {
    const rejectedTraversals = [
      { input: '../../../etc/passwd', desc: 'simple ../ traversal' },
      { input: '../../secret', desc: '../../ chained traversal' },
      { input: '../file', desc: '../ at start' },
      { input: '....//etc/passwd', desc: 'double-encoded traversal (....//): normalizes to ../.. which starts with ..' },
    ]

    for (const { input, desc } of rejectedTraversals) {
      it(`rejects ${desc}`, () => {
        expectPathRejected(input)
      })
    }

    it('normalizes mid-path traversal without rejecting absolute paths', () => {
      // /home/user/../../../etc/passwd normalizes to /etc/passwd
      // This is allowed when allowedPaths is null (permissive mode)
      const result = validatePath('/home/user/../../../etc/passwd', PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('/etc/passwd')
      }
    })

    it('rejects traversal when path escapes allowed directory', () => {
      const result = validatePath('/home/user/../../etc/passwd', {
        allowedPaths: ['/home/user'],
        blockedExtensions: [],
        checkExtension: false,
      })
      expect(result.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Length boundaries
  // ---------------------------------------------------------------------------
  describe('length boundaries', () => {
    it('accepts path at exactly max length (4096)', () => {
      const path = `/${'a'.repeat(SFTP_LIMITS.MAX_PATH_LENGTH - 1)}`
      const result = validatePath(path, PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(true)
    })

    const rejectedLengths = [
      { fill: SFTP_LIMITS.MAX_PATH_LENGTH, desc: 'one char over max length (4097)' },
      { fill: 100_000, desc: 'very long path (100000 chars)' },
    ]

    for (const { fill, desc } of rejectedLengths) {
      it(`rejects path ${desc}`, () => {
        expectPathRejected(`/${'x'.repeat(fill)}`)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Shell metacharacters in paths
  // ---------------------------------------------------------------------------
  describe('shell metacharacters in paths', () => {
    // These are valid paths — validatePath should accept them.
    // The shell escaping layer handles safety.
    const metaPaths = [
      "/home/user/; rm -rf /",
      '/home/user/$(whoami)',
      '/home/user/`id`',
      '/home/user/ | cat /etc/passwd',
      '/home/user/$HOME',
      '/home/user/file name with spaces',
      "/home/user/it's a file",
    ]

    for (const path of metaPaths) {
      it(`accepts path with shell metacharacters: ${JSON.stringify(path)}`, () => {
        const result = validatePath(path, PERMISSIVE_OPTIONS)
        expect(result.ok).toBe(true)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Allowed paths enforcement
  // ---------------------------------------------------------------------------
  describe('allowed paths enforcement', () => {
    const restrictedOptions = {
      allowedPaths: ['/home/user', '~/'],
      blockedExtensions: [],
      checkExtension: false,
    } as const

    const acceptedPaths = [
      { input: '/home/user', desc: 'exact match' },
      { input: '/home/user/docs/file.txt', desc: 'subdirectory' },
      { input: '~/documents', desc: 'home directory expansion' },
    ]

    for (const { input, desc } of acceptedPaths) {
      it(`allows ${desc}`, () => {
        const result = validatePath(input, restrictedOptions)
        expect(result.ok).toBe(true)
      })
    }

    const rejectedPaths = [
      { input: '/home/other', desc: 'sibling directory' },
      { input: '/home', desc: 'parent directory' },
      { input: '/', desc: 'root' },
    ]

    for (const { input, desc } of rejectedPaths) {
      it(`rejects ${desc}`, () => {
        const result = validatePath(input, restrictedOptions)
        expect(result.ok).toBe(false)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Extension blocking
  // ---------------------------------------------------------------------------
  describe('extension blocking', () => {
    const blockExeOptions = {
      allowedPaths: null,
      blockedExtensions: ['.exe', '.dll', '.so'],
      checkExtension: true,
    } as const

    const blockedCases = [
      { input: '/home/user/malware.exe', desc: '.exe extension' },
      { input: '/home/user/library.dll', desc: '.dll extension' },
      { input: '/home/user/malware.EXE', desc: 'case-insensitive .EXE' },
    ]

    for (const { input, desc } of blockedCases) {
      it(`blocks ${desc}`, () => {
        const result = validatePath(input, blockExeOptions)
        expect(result.ok).toBe(false)
      })
    }

    const allowedCases = [
      { input: '/home/user/doc.txt', desc: 'non-blocked extension' },
      { input: '/home/user/Makefile', desc: 'no extension' },
    ]

    for (const { input, desc } of allowedCases) {
      it(`allows ${desc}`, () => {
        const result = validatePath(input, blockExeOptions)
        expect(result.ok).toBe(true)
      })
    }
  })
})

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
  describe('single quote edge cases', () => {
    const cases = [
      { input: "'", desc: 'single quote alone' },
      { input: "''", desc: 'double single quote' },
      { input: "'''", desc: 'triple single quote' },
      { input: "'hello", desc: 'single quote at start' },
      { input: "hello'", desc: 'single quote at end' },
      { input: "'hello'", desc: 'single quotes surrounding text' },
      { input: String.raw`'\''`, desc: 'nested quote escape pattern' },
      { input: String.raw`'\''$(id)'\''`, desc: 'injection via quote escape confusion' },
      { input: "a'b'c'd'e", desc: 'alternating quotes and text' },
    ]

    for (const { input, desc } of cases) {
      it(`handles ${desc}`, () => {
        expectShellSafe(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Double quote and mixed quoting
  // ---------------------------------------------------------------------------
  describe('double quotes and mixed quoting', () => {
    const cases = [
      { input: '"hello world"', desc: 'double quotes' },
      { input: 'he said "it\'s fine"', desc: 'mixed single and double quotes' },
      { input: String.raw`\"`, desc: 'backslash-double-quote combo' },
      { input: '"$HOME"', desc: 'dollar-in-double-quotes' },
    ]

    for (const { input, desc } of cases) {
      it(`handles ${desc}`, () => {
        expectShellSafe(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Special characters
  // ---------------------------------------------------------------------------
  describe('special characters', () => {
    const cases = [
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
    ]

    for (const { input, desc } of cases) {
      it(`handles ${desc}`, () => {
        expectShellSafe(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Control characters
  // ---------------------------------------------------------------------------
  describe('control characters', () => {
    const cases = [
      { input: '\x07', desc: 'bell character' },
      { input: '\x08', desc: 'backspace' },
      { input: '\x0B', desc: 'vertical tab' },
      { input: '\x0C', desc: 'form feed' },
      { input: '\x1B', desc: 'escape character' },
      { input: '\x1B[31mred\x1B[0m', desc: 'ANSI escape sequence' },
      { input: '\x7F', desc: 'DEL character' },
    ]

    for (const { input, desc } of cases) {
      it(`handles ${desc}`, () => {
        expectShellSafe(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Unicode
  // ---------------------------------------------------------------------------
  describe('unicode', () => {
    const cases = [
      { input: '\u202E', desc: 'RTL override character' },
      { input: '\uFEFF', desc: 'BOM' },
      { input: '\u200B', desc: 'zero-width space' },
      { input: '\u200D', desc: 'zero-width joiner' },
      { input: '\u0430', desc: 'homoglyph: Cyrillic а (looks like Latin a)' },
      { input: 'file_\uD83D\uDE00.txt', desc: 'emoji' },
      { input: '文件.txt', desc: 'CJK characters' },
      { input: 'file\u0301.txt', desc: 'combining diacritical marks' },
    ]

    for (const { input, desc } of cases) {
      it(`handles ${desc}`, () => {
        expectShellSafe(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Boundary conditions
  // ---------------------------------------------------------------------------
  describe('boundary conditions', () => {
    const cases = [
      { input: '', desc: 'empty string' },
      { input: 'a', desc: 'single character' },
      { input: '   ', desc: 'whitespace-only string' },
      { input: 'a'.repeat(1000), desc: 'long string (1000 chars)' },
      { input: "'''''", desc: 'string of all single quotes' },
      { input: "important_doc'; DROP TABLE users;--.pdf", desc: 'realistic malicious filename' },
    ]

    for (const { input, desc } of cases) {
      it(`handles ${desc}`, () => {
        expectShellSafe(input)
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Flag injection (cat/ls argument abuse)
  // ---------------------------------------------------------------------------
  describe('flag injection', () => {
    const cases = [
      { input: '--help', desc: '--help as path' },
      { input: '-rf', desc: '-rf as path' },
      { input: '--version', desc: '--version as path' },
      { input: '-e exec', desc: '-e with command as path' },
    ]

    for (const { input, desc } of cases) {
      it(`handles ${desc}`, () => {
        expectShellSafe(input)
      })
    }
  })
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
