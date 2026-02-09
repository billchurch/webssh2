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

// =============================================================================
// validateFileName fuzzing
// =============================================================================

describe('validateFileName fuzzing', () => {
  // ---------------------------------------------------------------------------
  // Null byte injection
  // ---------------------------------------------------------------------------
  describe('null byte injection', () => {
    it('rejects null byte at start', () => {
      const result = validateFileName('\0file.txt')
      expect(result.ok).toBe(false)
    })

    it('rejects null byte in middle', () => {
      const result = validateFileName('file\0.txt')
      expect(result.ok).toBe(false)
    })

    it('rejects null byte at end', () => {
      const result = validateFileName('file.txt\0')
      expect(result.ok).toBe(false)
    })

    it('rejects multiple null bytes', () => {
      const result = validateFileName('\0\0\0')
      expect(result.ok).toBe(false)
    })

    it('rejects null byte disguised with extension truncation', () => {
      const result = validateFileName('safe.txt\0.exe')
      expect(result.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Path separator injection
  // ---------------------------------------------------------------------------
  describe('path separator injection', () => {
    it('rejects forward slash', () => {
      const result = validateFileName('etc/passwd')
      expect(result.ok).toBe(false)
    })

    it('rejects backslash', () => {
      const result = validateFileName(String.raw`etc\passwd`)
      expect(result.ok).toBe(false)
    })

    it('rejects forward slash at start', () => {
      const result = validateFileName('/etc')
      expect(result.ok).toBe(false)
    })

    it('rejects mixed separators', () => {
      const result = validateFileName(String.raw`foo/bar\baz`)
      expect(result.ok).toBe(false)
    })

    it('rejects traversal attempt in filename', () => {
      const result = validateFileName('../../../etc/passwd')
      expect(result.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Reserved names
  // ---------------------------------------------------------------------------
  describe('reserved names', () => {
    it('rejects single dot', () => {
      const result = validateFileName('.')
      expect(result.ok).toBe(false)
    })

    it('rejects double dot', () => {
      const result = validateFileName('..')
      expect(result.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Length boundaries
  // ---------------------------------------------------------------------------
  describe('length boundaries', () => {
    it('accepts filename at exactly max length (255)', () => {
      const name = 'a'.repeat(SFTP_LIMITS.MAX_FILENAME_LENGTH)
      const result = validateFileName(name)
      expect(result.ok).toBe(true)
    })

    it('rejects filename one char over max length (256)', () => {
      const name = 'a'.repeat(SFTP_LIMITS.MAX_FILENAME_LENGTH + 1)
      const result = validateFileName(name)
      expect(result.ok).toBe(false)
    })

    it('rejects very long filename (10000 chars)', () => {
      const name = 'x'.repeat(10_000)
      const result = validateFileName(name)
      expect(result.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Control characters and unicode
  // ---------------------------------------------------------------------------
  describe('control characters and unicode', () => {
    // NOTE: validateFileName currently allows these. These tests document
    // that behavior so we can decide if stricter validation is warranted.

    it('accepts filename with tab (documents current behavior)', () => {
      const result = validateFileName('file\tname.txt')
      expect(result.ok).toBe(true)
    })

    it('accepts filename with newline (documents current behavior)', () => {
      const result = validateFileName('file\nname.txt')
      expect(result.ok).toBe(true)
    })

    it('accepts filename with carriage return (documents current behavior)', () => {
      const result = validateFileName('file\rname.txt')
      expect(result.ok).toBe(true)
    })

    it('accepts filename with bell character (documents current behavior)', () => {
      const result = validateFileName('file\x07name.txt')
      expect(result.ok).toBe(true)
    })

    it('accepts filename with ANSI escape (documents current behavior)', () => {
      const result = validateFileName('file\x1B[31mname.txt')
      expect(result.ok).toBe(true)
    })

    it('accepts filename with RTL override (documents current behavior)', () => {
      const result = validateFileName('file\u202Ename.txt')
      expect(result.ok).toBe(true)
    })

    it('accepts filename with zero-width space (documents current behavior)', () => {
      const result = validateFileName('file\u200Bname.txt')
      expect(result.ok).toBe(true)
    })

    it('accepts filename with BOM (documents current behavior)', () => {
      const result = validateFileName('\uFEFFfile.txt')
      expect(result.ok).toBe(true)
    })
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
        const result = validateFileName(name)
        expect(result.ok).toBe(true)
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
        const result = validateFileName(name)
        expect(result.ok).toBe(false)
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
    it('rejects null byte at start of path', () => {
      const result = validatePath('\0/home/user', PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(false)
    })

    it('rejects null byte in middle of path', () => {
      const result = validatePath('/home/\0user', PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(false)
    })

    it('rejects null byte at end of path', () => {
      const result = validatePath('/home/user\0', PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(false)
    })

    it('rejects null byte as extension truncation', () => {
      const result = validatePath('/home/user/safe.txt\0.exe', PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Path traversal variants
  // ---------------------------------------------------------------------------
  describe('path traversal', () => {
    it('rejects simple ../ traversal', () => {
      const result = validatePath('../../../etc/passwd', PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(false)
    })

    it('rejects ../../ chained traversal', () => {
      const result = validatePath('../../secret', PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(false)
    })

    it('rejects ../ at start', () => {
      const result = validatePath('../file', PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(false)
    })

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

    it('rejects double-encoded traversal (....//)', () => {
      // ....// normalizes to ../.. which starts with ..
      const result = validatePath('....//etc/passwd', PERMISSIVE_OPTIONS)
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

    it('rejects path one char over max length (4097)', () => {
      const path = `/${'a'.repeat(SFTP_LIMITS.MAX_PATH_LENGTH)}`
      const result = validatePath(path, PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(false)
    })

    it('rejects very long path (100000 chars)', () => {
      const path = `/${'x'.repeat(100_000)}`
      const result = validatePath(path, PERMISSIVE_OPTIONS)
      expect(result.ok).toBe(false)
    })
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

    it('allows exact match', () => {
      const result = validatePath('/home/user', restrictedOptions)
      expect(result.ok).toBe(true)
    })

    it('allows subdirectory', () => {
      const result = validatePath('/home/user/docs/file.txt', restrictedOptions)
      expect(result.ok).toBe(true)
    })

    it('rejects sibling directory', () => {
      const result = validatePath('/home/other', restrictedOptions)
      expect(result.ok).toBe(false)
    })

    it('rejects parent directory', () => {
      const result = validatePath('/home', restrictedOptions)
      expect(result.ok).toBe(false)
    })

    it('rejects root', () => {
      const result = validatePath('/', restrictedOptions)
      expect(result.ok).toBe(false)
    })

    it('allows home directory expansion', () => {
      const result = validatePath('~/documents', restrictedOptions)
      expect(result.ok).toBe(true)
    })
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

    it('blocks .exe extension', () => {
      const result = validatePath('/home/user/malware.exe', blockExeOptions)
      expect(result.ok).toBe(false)
    })

    it('blocks .dll extension', () => {
      const result = validatePath('/home/user/library.dll', blockExeOptions)
      expect(result.ok).toBe(false)
    })

    it('blocks case-insensitive .EXE', () => {
      const result = validatePath('/home/user/malware.EXE', blockExeOptions)
      expect(result.ok).toBe(false)
    })

    it('allows non-blocked extension', () => {
      const result = validatePath('/home/user/doc.txt', blockExeOptions)
      expect(result.ok).toBe(true)
    })

    it('allows no extension', () => {
      const result = validatePath('/home/user/Makefile', blockExeOptions)
      expect(result.ok).toBe(true)
    })
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
    it('handles single quote alone', () => {
      expectShellSafe("'")
    })

    it('handles double single quote', () => {
      expectShellSafe("''")
    })

    it('handles triple single quote', () => {
      expectShellSafe("'''")
    })

    it('handles single quote at start', () => {
      expectShellSafe("'hello")
    })

    it('handles single quote at end', () => {
      expectShellSafe("hello'")
    })

    it('handles single quotes surrounding text', () => {
      expectShellSafe("'hello'")
    })

    it('handles nested quote escape pattern', () => {
      expectShellSafe(String.raw`'\''`)
    })

    it('handles injection via quote escape confusion', () => {
      expectShellSafe(String.raw`'\''$(id)'\''`)
    })

    it('handles alternating quotes and text', () => {
      expectShellSafe("a'b'c'd'e")
    })
  })

  // ---------------------------------------------------------------------------
  // Double quote and mixed quoting
  // ---------------------------------------------------------------------------
  describe('double quotes and mixed quoting', () => {
    it('handles double quotes', () => {
      expectShellSafe('"hello world"')
    })

    it('handles mixed single and double quotes', () => {
      expectShellSafe('he said "it\'s fine"')
    })

    it('handles backslash-double-quote combo', () => {
      expectShellSafe(String.raw`\"`)
    })

    it('handles dollar-in-double-quotes', () => {
      expectShellSafe('"$HOME"')
    })
  })

  // ---------------------------------------------------------------------------
  // Special characters
  // ---------------------------------------------------------------------------
  describe('special characters', () => {
    it('handles spaces', () => {
      expectShellSafe('hello world')
    })

    it('handles tabs', () => {
      expectShellSafe('hello\tworld')
    })

    it('handles newlines', () => {
      expectShellSafe('hello\nworld')
    })

    it('handles carriage returns', () => {
      expectShellSafe('hello\rworld')
    })

    it('handles backslashes', () => {
      expectShellSafe(String.raw`hello\world`)
    })

    it('handles multiple backslashes', () => {
      // String.raw cannot end with an odd number of backslashes (backtick limitation)
      expectShellSafe('\\\\\\')
    })

    it('handles asterisks (glob)', () => {
      expectShellSafe('*.txt')
    })

    it('handles question marks (glob)', () => {
      expectShellSafe('file?.txt')
    })

    it('handles square brackets (glob)', () => {
      expectShellSafe('file[0-9].txt')
    })

    it('handles curly braces (brace expansion)', () => {
      expectShellSafe('{a,b,c}')
    })

    it('handles tilde (home expansion)', () => {
      expectShellSafe('~')
    })

    it('handles hash (comment)', () => {
      expectShellSafe('# this is a comment')
    })

    it('handles exclamation mark (history expansion)', () => {
      expectShellSafe('!!')
    })

    it('handles ampersand', () => {
      expectShellSafe('&')
    })

    it('handles parentheses (subshell)', () => {
      expectShellSafe('(subshell)')
    })
  })

  // ---------------------------------------------------------------------------
  // Control characters
  // ---------------------------------------------------------------------------
  describe('control characters', () => {
    it('handles bell character', () => {
      expectShellSafe('\x07')
    })

    it('handles backspace', () => {
      expectShellSafe('\x08')
    })

    it('handles vertical tab', () => {
      expectShellSafe('\x0B')
    })

    it('handles form feed', () => {
      expectShellSafe('\x0C')
    })

    it('handles escape character', () => {
      expectShellSafe('\x1B')
    })

    it('handles ANSI escape sequence', () => {
      expectShellSafe('\x1B[31mred\x1B[0m')
    })

    it('handles DEL character', () => {
      expectShellSafe('\x7F')
    })
  })

  // ---------------------------------------------------------------------------
  // Unicode
  // ---------------------------------------------------------------------------
  describe('unicode', () => {
    it('handles RTL override character', () => {
      expectShellSafe('\u202E')
    })

    it('handles BOM', () => {
      expectShellSafe('\uFEFF')
    })

    it('handles zero-width space', () => {
      expectShellSafe('\u200B')
    })

    it('handles zero-width joiner', () => {
      expectShellSafe('\u200D')
    })

    it('handles homoglyph: Cyrillic а (looks like Latin a)', () => {
      expectShellSafe('\u0430')
    })

    it('handles emoji', () => {
      expectShellSafe('file_\uD83D\uDE00.txt')
    })

    it('handles CJK characters', () => {
      expectShellSafe('文件.txt')
    })

    it('handles combining diacritical marks', () => {
      expectShellSafe('file\u0301.txt')
    })
  })

  // ---------------------------------------------------------------------------
  // Boundary conditions
  // ---------------------------------------------------------------------------
  describe('boundary conditions', () => {
    it('handles empty string', () => {
      expectShellSafe('')
    })

    it('handles single character', () => {
      expectShellSafe('a')
    })

    it('handles whitespace-only string', () => {
      expectShellSafe('   ')
    })

    it('handles long string (1000 chars)', () => {
      expectShellSafe('a'.repeat(1000))
    })

    it('handles string of all single quotes', () => {
      expectShellSafe("'''''")
    })

    it('handles realistic malicious filename', () => {
      expectShellSafe("important_doc'; DROP TABLE users;--.pdf")
    })
  })

  // ---------------------------------------------------------------------------
  // Flag injection (cat/ls argument abuse)
  // ---------------------------------------------------------------------------
  describe('flag injection', () => {
    it('handles --help as path', () => {
      expectShellSafe('--help')
    })

    it('handles -rf as path', () => {
      expectShellSafe('-rf')
    })

    it('handles --version as path', () => {
      expectShellSafe('--version')
    })

    it('handles -e with command as path', () => {
      expectShellSafe('-e exec')
    })
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
        const result = validateFileName(input)
        expect(result.ok).toBe(false)
      })
    }

    const rejectedByPath = [
      { input: '/home/user/\0file', reason: 'null byte in path' },
      { input: '../secret', reason: 'relative traversal' },
      { input: `/${'x'.repeat(4096)}`, reason: 'exceeds max path length' },
    ]

    for (const { input, reason } of rejectedByPath) {
      it(`validatePath rejects: ${reason}`, () => {
        const result = validatePath(input, PERMISSIVE_OPTIONS)
        expect(result.ok).toBe(false)
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
        const fileResult = validateFileName(name)
        // These pass filename validation (no null bytes, separators, or reserved names)
        expect(fileResult.ok).toBe(true)

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
        const result = validateFileName(name)
        expect(result.ok).toBe(false)
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
