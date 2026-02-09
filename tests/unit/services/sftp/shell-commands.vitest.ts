/**
 * Shell Commands Unit Tests
 *
 * Tests for pure functions that build shell commands and parse ls output.
 *
 * @module tests/unit/services/sftp/shell-commands
 */

import { describe, it, expect } from 'vitest'
import {
  escapeShellPath,
  buildListCommand,
  buildStatCommand,
  buildHomeCommand,
  resolveHomePath,
  parseDirectoryListing,
  parseStatEntry,
  parseLsLine,
  parsePermissionString,
  parseLsDate
} from '../../../../app/services/sftp/shell-commands.js'

describe('shell-commands', () => {
  // ==========================================================================
  // escapeShellPath
  // ==========================================================================
  describe('escapeShellPath', () => {
    it('wraps simple paths in single quotes', () => {
      expect(escapeShellPath('/home/user')).toBe("'/home/user'")
    })

    it('escapes single quotes in paths', () => {
      expect(escapeShellPath("/home/user's files")).toBe("'/home/user'\\''s files'")
    })

    it('handles multiple single quotes', () => {
      expect(escapeShellPath("it's a 'test'")).toBe("'it'\\''s a '\\''test'\\'''")
    })

    it('handles paths with spaces', () => {
      expect(escapeShellPath('/home/user/my documents')).toBe("'/home/user/my documents'")
    })

    it('handles paths with special characters', () => {
      expect(escapeShellPath('/home/user/$HOME')).toBe("'/home/user/$HOME'")
      expect(escapeShellPath('/home/user/`cmd`')).toBe("'/home/user/`cmd`'")
      expect(escapeShellPath('/home/user/$(cmd)')).toBe("'/home/user/$(cmd)'")
    })

    it('handles empty string', () => {
      expect(escapeShellPath('')).toBe("''")
    })

    it('handles paths with semicolons and pipes', () => {
      expect(escapeShellPath('/home/user; rm -rf /')).toBe("'/home/user; rm -rf /'")
      expect(escapeShellPath('/home/user | cat /etc/passwd')).toBe("'/home/user | cat /etc/passwd'")
    })
  })

  // ==========================================================================
  // buildListCommand
  // ==========================================================================
  describe('buildListCommand', () => {
    it('builds ls -la command without hidden files', () => {
      expect(buildListCommand('/home/user', false)).toBe("ls -la '/home/user'")
    })

    it('builds ls -laA command with hidden files', () => {
      expect(buildListCommand('/home/user', true)).toBe("ls -laA '/home/user'")
    })

    it('escapes paths with special characters', () => {
      expect(buildListCommand("/home/user's dir", false)).toBe("ls -la '/home/user'\\''s dir'")
    })
  })

  // ==========================================================================
  // buildStatCommand
  // ==========================================================================
  describe('buildStatCommand', () => {
    it('builds ls -lad command', () => {
      expect(buildStatCommand('/home/user/file.txt')).toBe("ls -lad '/home/user/file.txt'")
    })

    it('escapes paths', () => {
      expect(buildStatCommand('/tmp/my file.txt')).toBe("ls -lad '/tmp/my file.txt'")
    })
  })

  // ==========================================================================
  // buildHomeCommand / resolveHomePath
  // ==========================================================================
  describe('buildHomeCommand', () => {
    it('returns echo ~ command', () => {
      expect(buildHomeCommand()).toBe('echo ~')
    })
  })

  describe('resolveHomePath', () => {
    it('trims whitespace from output', () => {
      expect(resolveHomePath('/home/user\n')).toBe('/home/user')
    })

    it('handles output with trailing newline', () => {
      expect(resolveHomePath('/root\n')).toBe('/root')
    })

    it('handles output without trailing newline', () => {
      expect(resolveHomePath('/home/user')).toBe('/home/user')
    })
  })

  // ==========================================================================
  // parsePermissionString
  // ==========================================================================
  describe('parsePermissionString', () => {
    it('parses full permissions', () => {
      expect(parsePermissionString('-rwxrwxrwx')).toBe(0o777)
    })

    it('parses typical directory permissions', () => {
      expect(parsePermissionString('drwxr-xr-x')).toBe(0o755)
    })

    it('parses read-only permissions', () => {
      expect(parsePermissionString('-r--r--r--')).toBe(0o444)
    })

    it('parses no permissions', () => {
      expect(parsePermissionString('----------')).toBe(0o000)
    })

    it('parses user-only write', () => {
      expect(parsePermissionString('-rw-r--r--')).toBe(0o644)
    })

    it('parses symlink permissions', () => {
      expect(parsePermissionString('lrwxrwxrwx')).toBe(0o777)
    })
  })

  // ==========================================================================
  // parseLsDate
  // ==========================================================================
  describe('parseLsDate', () => {
    it('parses date with time (recent file)', () => {
      const result = parseLsDate('Jan', '15', '10:30')
      const date = new Date(result)
      expect(date.getMonth()).toBe(0) // January
      expect(date.getDate()).toBe(15)
      expect(date.getHours()).toBe(10)
      expect(date.getMinutes()).toBe(30)
    })

    it('parses date with year (old file)', () => {
      const result = parseLsDate('Dec', '31', '2023')
      const date = new Date(result)
      expect(date.getFullYear()).toBe(2023)
      expect(date.getMonth()).toBe(11) // December
      expect(date.getDate()).toBe(31)
    })

    it('handles invalid month', () => {
      const result = parseLsDate('Xyz', '1', '2023')
      expect(new Date(result).getTime()).toBe(0)
    })

    it('handles all months', () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      for (const [index, month] of months.entries()) {
        const result = parseLsDate(month, '1', '2023')
        const date = new Date(result)
        expect(date.getMonth()).toBe(index)
      }
    })
  })

  // ==========================================================================
  // parseLsLine
  // ==========================================================================
  describe('parseLsLine', () => {
    it('parses a regular file entry (GNU coreutils)', () => {
      const line = '-rw-r--r--    1 root     root          1234 Jan  1  2024 file.txt'
      const entry = parseLsLine(line, '/home')

      expect(entry).not.toBeNull()
      expect(entry?.name).toBe('file.txt')
      expect(entry?.path).toBe('/home/file.txt')
      expect(entry?.type).toBe('file')
      expect(entry?.size).toBe(1234)
      expect(entry?.permissions).toBe('rw-r--r--')
      expect(entry?.permissionsOctal).toBe(0o644)
      expect(entry?.owner).toBe('root')
      expect(entry?.group).toBe('root')
      expect(entry?.isHidden).toBe(false)
    })

    it('parses a directory entry', () => {
      const line = 'drwxr-xr-x    2 user     group         4096 Feb 15 10:30 subdir'
      const entry = parseLsLine(line, '/home/user')

      expect(entry).not.toBeNull()
      expect(entry?.name).toBe('subdir')
      expect(entry?.path).toBe('/home/user/subdir')
      expect(entry?.type).toBe('directory')
      expect(entry?.size).toBe(4096)
      expect(entry?.permissionsOctal).toBe(0o755)
    })

    it('parses a symlink entry', () => {
      const line = 'lrwxrwxrwx    1 root     root            12 Mar  5 08:00 link -> /target'
      const entry = parseLsLine(line, '/home')

      expect(entry).not.toBeNull()
      expect(entry?.name).toBe('link')
      expect(entry?.type).toBe('symlink')
    })

    it('parses a hidden file entry', () => {
      const line = '-rw-------    1 user     user           256 Apr 10  2023 .bashrc'
      const entry = parseLsLine(line, '/home/user')

      expect(entry).not.toBeNull()
      expect(entry?.name).toBe('.bashrc')
      expect(entry?.isHidden).toBe(true)
    })

    it('parses entry with filename containing spaces', () => {
      const line = '-rw-r--r--    1 user     group          100 Jan  1  2024 my file name.txt'
      const entry = parseLsLine(line, '/tmp')

      expect(entry).not.toBeNull()
      expect(entry?.name).toBe('my file name.txt')
      expect(entry?.path).toBe('/tmp/my file name.txt')
    })

    it('handles BusyBox-style output (compact spacing)', () => {
      const line = '-rw-r--r-- 1 root root 512 Jan  1 00:00 test.txt'
      const entry = parseLsLine(line, '/tmp')

      expect(entry).not.toBeNull()
      expect(entry?.name).toBe('test.txt')
      expect(entry?.size).toBe(512)
    })

    it('handles root basePath', () => {
      const line = '-rw-r--r--    1 root     root           100 Jan  1  2024 file.txt'
      const entry = parseLsLine(line, '/')

      expect(entry).not.toBeNull()
      expect(entry?.path).toBe('/file.txt')
    })

    it('handles dot basePath', () => {
      const line = '-rw-r--r--    1 root     root           100 Jan  1  2024 file.txt'
      const entry = parseLsLine(line, '.')

      expect(entry).not.toBeNull()
      expect(entry?.path).toBe('/file.txt')
    })

    it('returns null for lines with too few parts', () => {
      expect(parseLsLine('invalid line', '/')).toBeNull()
      expect(parseLsLine('', '/')).toBeNull()
    })

    it('returns null for lines with short permission string', () => {
      expect(parseLsLine('drwx 1 root root 0 Jan 1 2024 dir', '/')).toBeNull()
    })

    it('handles large file sizes', () => {
      const line = '-rw-r--r--    1 root     root     104857600 Jan  1  2024 large.iso'
      const entry = parseLsLine(line, '/home')

      expect(entry).not.toBeNull()
      expect(entry?.size).toBe(104857600)
    })
  })

  // ==========================================================================
  // parseDirectoryListing
  // ==========================================================================
  describe('parseDirectoryListing', () => {
    it('parses full GNU coreutils ls output', () => {
      const stdout = `total 20
drwxr-xr-x    4 root     root          4096 Jan  1  2024 .
drwxr-xr-x   20 root     root          4096 Jan  1  2024 ..
-rw-r--r--    1 root     root           100 Jan  1  2024 file1.txt
-rw-r--r--    1 root     root           200 Jan  1  2024 file2.txt
drwxr-xr-x    2 root     root          4096 Jan  1  2024 subdir`

      const entries = parseDirectoryListing(stdout, '/home')

      // Should skip total, . and ..
      expect(entries).toHaveLength(3)
      expect(entries[0]?.name).toBe('file1.txt')
      expect(entries[1]?.name).toBe('file2.txt')
      expect(entries[2]?.name).toBe('subdir')
    })

    it('handles empty directory (only . and ..)', () => {
      const stdout = `total 8
drwxr-xr-x    2 root     root          4096 Jan  1  2024 .
drwxr-xr-x   10 root     root          4096 Jan  1  2024 ..`

      const entries = parseDirectoryListing(stdout, '/empty')
      expect(entries).toHaveLength(0)
    })

    it('handles empty output', () => {
      expect(parseDirectoryListing('', '/home')).toHaveLength(0)
    })

    it('handles output with hidden files', () => {
      const stdout = `total 12
-rw-r--r--    1 user     user           100 Jan  1  2024 .bashrc
-rw-r--r--    1 user     user           200 Jan  1  2024 .profile
-rw-r--r--    1 user     user           300 Jan  1  2024 readme.txt`

      const entries = parseDirectoryListing(stdout, '/home/user')
      expect(entries).toHaveLength(3)
      expect(entries[0]?.name).toBe('.bashrc')
      expect(entries[0]?.isHidden).toBe(true)
      expect(entries[2]?.name).toBe('readme.txt')
      expect(entries[2]?.isHidden).toBe(false)
    })

    it('handles BusyBox-style ls output', () => {
      const stdout = `drwxr-xr-x 2 root root 4096 Jan  1 00:00 bin
drwxr-xr-x 4 root root 4096 Jan  1 00:00 etc
-rw-r--r-- 1 root root  512 Jan  1 00:00 init`

      const entries = parseDirectoryListing(stdout, '/')
      expect(entries).toHaveLength(3)
      expect(entries[0]?.name).toBe('bin')
      expect(entries[0]?.type).toBe('directory')
      expect(entries[2]?.name).toBe('init')
      expect(entries[2]?.type).toBe('file')
    })
  })

  // ==========================================================================
  // parseStatEntry
  // ==========================================================================
  describe('parseStatEntry', () => {
    it('parses stat output for a file', () => {
      const stdout = '-rw-r--r--    1 root     root          1234 Jan  1  2024 file.txt\n'
      const entry = parseStatEntry(stdout, '/home/user/file.txt')

      expect(entry).not.toBeNull()
      expect(entry?.name).toBe('file.txt')
      expect(entry?.path).toBe('/home/user/file.txt')
      expect(entry?.type).toBe('file')
      expect(entry?.size).toBe(1234)
    })

    it('parses stat output for a directory', () => {
      const stdout = 'drwxr-xr-x    4 root     root          4096 Jan  1  2024 home\n'
      const entry = parseStatEntry(stdout, '/home')

      expect(entry).not.toBeNull()
      expect(entry?.type).toBe('directory')
      expect(entry?.path).toBe('/home')
    })

    it('returns null for empty output', () => {
      expect(parseStatEntry('', '/home/file.txt')).toBeNull()
    })

    it('returns null for unparseable output', () => {
      expect(parseStatEntry('some error message', '/home/file.txt')).toBeNull()
    })

    it('skips total line in output', () => {
      const stdout = `total 4
-rw-r--r--    1 root     root           100 Jan  1  2024 file.txt`
      const entry = parseStatEntry(stdout, '/home/file.txt')
      expect(entry).not.toBeNull()
      expect(entry?.path).toBe('/home/file.txt')
    })
  })
})
