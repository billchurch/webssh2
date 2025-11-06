// tests/unit/socket/handlers/terminal-handler.test.ts
// Unit tests for pure terminal handler functions

import { describe, it, expect } from 'vitest'
import {
  validateTerminalDimensions,
  validateTerminalType,
  processTerminalUpdate,
  createTerminalState,
  handleTerminalSetup,
  handleTerminalResize,
  mergeTerminalConfig,
  type TerminalConfig,
} from '../../../../app/socket/handlers/terminal-handler.js'
import { DEFAULTS, DEFAULT_AUTH_METHODS } from '../../../../app/constants.js'
import type { Config } from '../../../../app/types/config.js'
import { createAuthMethod } from '../../../../app/types/branded.js'

describe('Terminal Handler', () => {
  const mockConfig: Config = {
    ssh: {
      term: 'xterm-color',
      disableInteractiveAuth: false,
      port: 22,
      algorithms: {},
      keepaliveInterval: 60000,
      keepaliveCountMax: 10,
      readyTimeout: 20000,
      allowedAuthMethods: DEFAULT_AUTH_METHODS.map(createAuthMethod),
    },
    user: {},
    options: {},
  } as Config

  describe('validateTerminalDimensions', () => {
    it('should validate valid dimensions', () => {
      const result = validateTerminalDimensions(80, 24)
      
      expect(result.valid).toBe(true)
      expect(result.cols).toBe(80)
      expect(result.rows).toBe(24)
    })

    it('should handle string dimensions', () => {
      const result = validateTerminalDimensions('120', '40')
      
      expect(result.valid).toBe(true)
      expect(result.cols).toBe(120)
      expect(result.rows).toBe(40)
    })

    it('should reject invalid columns', () => {
      const result = validateTerminalDimensions(-1, 24)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid columns value')
    })

    it('should reject invalid rows', () => {
      const result = validateTerminalDimensions(80, 0)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid rows value')
    })

    it('should reject dimensions over limit', () => {
      const result = validateTerminalDimensions(1001, 24)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid columns value')
    })

    it('should handle null dimensions', () => {
      const result = validateTerminalDimensions(null, null)
      
      expect(result.valid).toBe(true)
      expect(result.cols).toBeUndefined()
      expect(result.rows).toBeUndefined()
    })

    it('should handle partial dimensions', () => {
      const result = validateTerminalDimensions(80, null)
      
      expect(result.valid).toBe(true)
      expect(result.cols).toBe(80)
      expect(result.rows).toBeUndefined()
    })
  })

  describe('validateTerminalType', () => {
    it('should validate valid terminal type', () => {
      const result = validateTerminalType('xterm-256color')
      expect(result).toBe('xterm-256color')
    })

    it('should handle terminal with hyphens', () => {
      const result = validateTerminalType('screen-256color')
      expect(result).toBe('screen-256color')
    })

    it('should trim whitespace', () => {
      const result = validateTerminalType('  xterm  ')
      expect(result).toBe('xterm')
    })

    it('should reject invalid characters', () => {
      const result = validateTerminalType('xterm$invalid')
      expect(result).toBeNull()
    })

    it('should reject empty string', () => {
      const result = validateTerminalType('')
      expect(result).toBeNull()
    })

    it('should handle null', () => {
      const result = validateTerminalType(null)
      expect(result).toBeNull()
    })

    it('should reject non-string values', () => {
      const result = validateTerminalType(123)
      expect(result).toBeNull()
    })
  })

  describe('processTerminalUpdate', () => {
    it('should process valid terminal settings', () => {
      const currentConfig: TerminalConfig = {
        term: 'vt100',
        cols: 80,
        rows: 24,
      }
      
      const result = processTerminalUpdate(
        {
          term: 'xterm',
          cols: 120,
          rows: 40,
        },
        currentConfig
      )
      
      expect(result.success).toBe(true)
      expect(result.config).toEqual({
        term: 'xterm',
        cols: 120,
        rows: 40,
      })
    })

    it('should preserve existing values when not updated', () => {
      const currentConfig: TerminalConfig = {
        term: 'vt100',
        cols: 80,
        rows: 24,
      }
      
      const result = processTerminalUpdate(
        { cols: 100 },
        currentConfig
      )
      
      expect(result.success).toBe(true)
      expect(result.config).toEqual({
        term: 'vt100',
        cols: 100,
        rows: 24,
      })
    })

    it('should reject invalid settings format', () => {
      const currentConfig: TerminalConfig = {
        term: null,
        cols: null,
        rows: null,
      }
      
      const result = processTerminalUpdate(null, currentConfig)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid terminal settings')
    })

    it('should handle invalid dimensions gracefully', () => {
      const currentConfig: TerminalConfig = {
        term: 'xterm',
        cols: 80,
        rows: 24,
      }
      
      const result = processTerminalUpdate(
        { cols: -1 },
        currentConfig
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })
  })

  describe('createTerminalState', () => {
    it('should create terminal state with all values', () => {
      const config: TerminalConfig = {
        term: 'xterm-256color',
        cols: 120,
        rows: 40,
      }
      
      const result = createTerminalState(config, mockConfig)
      
      expect(result).toEqual({
        term: 'xterm-256color',
        cols: 120,
        rows: 40,
      })
    })

    it('should use server defaults for missing values', () => {
      const config: TerminalConfig = {
        term: null,
        cols: null,
        rows: null,
      }
      
      const result = createTerminalState(config, mockConfig)
      
      expect(result).toEqual({
        term: 'xterm-color',
        cols: DEFAULTS.TERM_COLS,
        rows: DEFAULTS.TERM_ROWS,
      })
    })

    it('should use system defaults when server config is empty string', () => {
      const config: TerminalConfig = {
        term: null,
        cols: null,
        rows: null,
      }
      
      const emptyConfig = {
        ...mockConfig,
        ssh: { ...mockConfig.ssh, term: '' },
      } as Config
      
      const result = createTerminalState(config, emptyConfig)
      
      expect(result).toEqual({
        term: DEFAULTS.SSH_TERM,
        cols: DEFAULTS.TERM_COLS,
        rows: DEFAULTS.TERM_ROWS,
      })
    })
  })

  describe('handleTerminalSetup', () => {
    it('should handle valid terminal setup', () => {
      const currentConfig: TerminalConfig = {
        term: null,
        cols: null,
        rows: null,
      }
      
      const result = handleTerminalSetup(
        {
          term: 'xterm',
          cols: 100,
          rows: 30,
        },
        currentConfig,
        mockConfig
      )
      
      expect(result.success).toBe(true)
      expect(result.terminal).toEqual({
        term: 'xterm',
        cols: 100,
        rows: 30,
      })
    })

    it('should handle partial terminal setup', () => {
      const currentConfig: TerminalConfig = {
        term: 'vt100',
        cols: 80,
        rows: 24,
      }
      
      const result = handleTerminalSetup(
        { cols: 120 },
        currentConfig,
        mockConfig
      )
      
      expect(result.success).toBe(true)
      expect(result.terminal?.cols).toBe(120)
      expect(result.terminal?.term).toBe('vt100')
    })

    it('should handle invalid setup', () => {
      const currentConfig: TerminalConfig = {
        term: null,
        cols: null,
        rows: null,
      }
      
      const result = handleTerminalSetup(
        { cols: -100 },
        currentConfig,
        mockConfig
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('handleTerminalResize', () => {
    it('should handle valid resize', () => {
      const result = handleTerminalResize({
        cols: 120,
        rows: 40,
      })
      
      expect(result.success).toBe(true)
      expect(result.cols).toBe(120)
      expect(result.rows).toBe(40)
    })

    it('should reject invalid resize data', () => {
      const result = handleTerminalResize(null)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid resize data')
    })

    it('should reject missing dimensions', () => {
      const result = handleTerminalResize({ cols: 80 })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Both cols and rows are required for resize')
    })

    it('should reject invalid dimensions', () => {
      const result = handleTerminalResize({
        cols: 0,
        rows: 24,
      })
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })
  })

  describe('mergeTerminalConfig', () => {
    it('should merge all sources correctly', () => {
      const clientSettings = {
        term: 'xterm-256color',
        cols: 120,
      }
      
      const sessionConfig: TerminalConfig = {
        term: 'vt100',
        cols: 80,
        rows: 24,
      }
      
      const result = mergeTerminalConfig(
        clientSettings,
        sessionConfig,
        mockConfig
      )
      
      expect(result).toEqual({
        term: 'xterm-256color',
        cols: 120,
        rows: 24,
      })
    })

    it('should use session config when client settings null', () => {
      const sessionConfig: TerminalConfig = {
        term: 'vt100',
        cols: 80,
        rows: 24,
      }
      
      const result = mergeTerminalConfig(
        null,
        sessionConfig,
        mockConfig
      )
      
      expect(result).toEqual(sessionConfig)
    })

    it('should use server defaults when both null', () => {
      const sessionConfig: TerminalConfig = {
        term: null,
        cols: null,
        rows: null,
      }
      
      const result = mergeTerminalConfig(
        null,
        sessionConfig,
        mockConfig
      )
      
      expect(result.term).toBe('xterm-color')
      expect(result.cols).toBeNull()
      expect(result.rows).toBeNull()
    })

    it('should validate terminal type from client', () => {
      const clientSettings = {
        term: 'invalid$term',
      }
      
      const sessionConfig: TerminalConfig = {
        term: 'vt100',
        cols: 80,
        rows: 24,
      }
      
      const result = mergeTerminalConfig(
        clientSettings,
        sessionConfig,
        mockConfig
      )
      
      // Invalid term should be ignored
      expect(result.term).toBe('vt100')
    })
  })
})
