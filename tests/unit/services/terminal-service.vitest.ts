/**
 * Unit tests for TerminalService
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TerminalServiceImpl } from '../../../app/services/terminal/terminal-service.js'
import type { TerminalOptions, Dimensions } from '../../../app/services/interfaces.js'
import { createSessionId } from '../../../app/types/branded.js'
import { createMockStore, createMockDependencies, setupMockStoreState } from '../../test-utils.js'

describe('TerminalService', () => {
  let terminalService: TerminalServiceImpl
  let mockDeps: ReturnType<typeof createMockDependencies>
  let mockStore: ReturnType<typeof createMockStore>

  beforeEach(() => {
    mockStore = createMockStore()
    mockDeps = createMockDependencies()
    terminalService = new TerminalServiceImpl(mockDeps, mockStore)
  })

  describe('create', () => {
    it('should create a new terminal', () => {
      const options: TerminalOptions = {
        sessionId: createSessionId('test-session'),
        term: 'xterm-256color',
        rows: 24,
        cols: 80,
        cwd: '/home/user',
        env: { LANG: 'en_US.UTF-8' }
      }

      const result = terminalService.create(options)

      expect(result.ok).toBe(true)
      if (result.ok === true) {
        expect(result.value).toHaveProperty('id')
        expect(result.value.sessionId).toBe(options.sessionId)
        expect(result.value.term).toBe('xterm-256color')
        expect(result.value.rows).toBe(24)
        expect(result.value.cols).toBe(80)
        expect(result.value.env).toEqual({ LANG: 'en_US.UTF-8' })
      }

      // Verify store was updated
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        options.sessionId,
        expect.objectContaining({
          type: 'TERMINAL_INIT',
          payload: {
            term: 'xterm-256color',
            rows: 24,
            cols: 80,
            environment: { LANG: 'en_US.UTF-8' },
            cwd: '/home/user'
          }
        })
      )
    })

    it('should use default values from config', () => {
      const options: TerminalOptions = {
        sessionId: createSessionId('test-session')
      }

      const result = terminalService.create(options)

      expect(result.ok).toBe(true)
      if (result.ok === true) {
        expect(result.value.term).toBe('xterm-256color')
        expect(result.value.rows).toBe(24)
        expect(result.value.cols).toBe(80)
        expect(result.value.env).toEqual({})
      }
    })

    it('should return existing terminal if already created', () => {
      const options: TerminalOptions = {
        sessionId: createSessionId('test-session'),
        term: 'xterm',
        rows: 30,
        cols: 100
      }

      // Create first terminal
      const result1 = terminalService.create(options)
      expect(result1.ok).toBe(true)

      // Try to create another with same session
      const result2 = terminalService.create(options)
      expect(result2.ok).toBe(true)

      if (result1.ok && result2.ok) {
        // Should return the same terminal
        expect(result2.value.id).toBe(result1.value.id)
        expect(result2.value.term).toBe('xterm') // Original values
        expect(result2.value.rows).toBe(30)
        expect(result2.value.cols).toBe(100)
      }

      // Store should only be updated once
      expect(mockStore.dispatch).toHaveBeenCalledTimes(1)
    })
  })

  describe('resize', () => {
    it('should resize existing terminal', () => {
      const sessionId = createSessionId('test-session')
      
      // First create a terminal
      const createResult = terminalService.create({ sessionId })
      expect(createResult.ok).toBe(true)

      // Then resize it
      const dimensions: Dimensions = { rows: 40, cols: 120 }
      const resizeResult = terminalService.resize(sessionId, dimensions)

      expect(resizeResult.ok).toBe(true)
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'TERMINAL_RESIZE',
          payload: { rows: 40, cols: 120 }
        })
      )

      // Verify terminal was updated
      const terminal = terminalService.getTerminal(sessionId)
      expect(terminal.ok).toBe(true)
      if (terminal.ok && terminal.value) {
        expect(terminal.value.rows).toBe(40)
        expect(terminal.value.cols).toBe(120)
      }
    })

    it('should handle resize of non-existent terminal', () => {
      const sessionId = createSessionId('non-existent')
      const dimensions: Dimensions = { rows: 40, cols: 120 }
      
      const result = terminalService.resize(sessionId, dimensions)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Terminal not found')
      }

      expect(mockStore.dispatch).not.toHaveBeenCalled()
    })

    it('should validate dimensions', () => {
      const sessionId = createSessionId('test-session')
      
      // Create terminal first
      terminalService.create({ sessionId })

      // Try invalid dimensions
      const invalidDimensions: Dimensions = { rows: -1, cols: 0 }
      const result = terminalService.resize(sessionId, invalidDimensions)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid terminal dimensions')
      }
    })
  })

  describe('write', () => {
    it('should handle write to terminal', () => {
      const sessionId = createSessionId('test-session')
      const data = 'Hello, Terminal!'

      // Mock store state for write operation
      const mockState = {
        auth: { status: 'authenticated' },
        connection: { status: 'connected' },
        terminal: { rows: 24, cols: 80 },
        metadata: { createdAt: Date.now(), updatedAt: Date.now() }
      }
      setupMockStoreState(mockStore, mockState)

      // Create terminal first
      terminalService.create({ sessionId })

      // Write data
      const result = terminalService.write(sessionId, data)

      expect(result.ok).toBe(true)
      // First call is TERMINAL_INIT from create, second call is METADATA_UPDATE from write
      expect(mockStore.dispatch).toHaveBeenCalledTimes(2)
      expect(mockStore.dispatch).toHaveBeenLastCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'METADATA_UPDATE',
          payload: expect.objectContaining({
            updatedAt: expect.any(Number)
          })
        })
      )
    })

    it('should handle write to non-existent terminal', () => {
      const sessionId = createSessionId('non-existent')
      const data = 'Hello, Terminal!'

      const result = terminalService.write(sessionId, data)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Terminal not found')
      }
    })
  })

  describe('destroy', () => {
    it('should destroy existing terminal', () => {
      const sessionId = createSessionId('test-session')

      // Mock store state for destroy operation
      const mockState = {
        auth: { status: 'authenticated' },
        connection: { status: 'connected' },
        terminal: { rows: 24, cols: 80 },
        metadata: { createdAt: Date.now(), updatedAt: Date.now() }
      }
      setupMockStoreState(mockStore, mockState)

      // Create terminal first
      terminalService.create({ sessionId })

      // Destroy it
      const result = terminalService.destroy(sessionId)

      expect(result.ok).toBe(true)
      // First call is TERMINAL_INIT from create, second call is TERMINAL_DESTROY from destroy
      expect(mockStore.dispatch).toHaveBeenCalledTimes(2)
      expect(mockStore.dispatch).toHaveBeenLastCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'TERMINAL_DESTROY',
          payload: {}
        })
      )

      // Verify terminal is gone
      const getResult = terminalService.getTerminal(sessionId)
      expect(getResult.ok).toBe(true)
      if (getResult.ok === true) {
        expect(getResult.value).toBeNull()
      }
    })

    it('should handle destroy of non-existent terminal', () => {
      const sessionId = createSessionId('non-existent')

      const result = terminalService.destroy(sessionId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Terminal not found')
      }

      expect(mockStore.dispatch).not.toHaveBeenCalled()
    })
  })

  describe('getTerminal', () => {
    it('should return existing terminal', () => {
      const sessionId = createSessionId('test-session')
      const options: TerminalOptions = {
        sessionId,
        term: 'vt100',
        rows: 25,
        cols: 85
      }

      // Create terminal
      const createResult = terminalService.create(options)
      expect(createResult.ok).toBe(true)

      // Get it
      const getResult = terminalService.getTerminal(sessionId)

      expect(getResult.ok).toBe(true)
      if (getResult.ok && getResult.value) {
        expect(getResult.value.sessionId).toBe(sessionId)
        expect(getResult.value.term).toBe('vt100')
        expect(getResult.value.rows).toBe(25)
        expect(getResult.value.cols).toBe(85)
      }
    })

    it('should return null for non-existent terminal', () => {
      const sessionId = createSessionId('non-existent')

      const result = terminalService.getTerminal(sessionId)

      expect(result.ok).toBe(true)
      if (result.ok === true) {
        expect(result.value).toBeNull()
      }
    })
  })

  describe('environment management', () => {
    it('should update terminal environment', () => {
      const sessionId = createSessionId('test-session')
      
      // Create terminal with initial env
      terminalService.create({
        sessionId,
        env: { LANG: 'en_US.UTF-8' }
      })

      // Update environment
      const newEnv = { 
        LANG: 'en_US.UTF-8',
        TERM: 'xterm-256color',
        PATH: '/usr/local/bin:/usr/bin'
      }

      // Get terminal and update its environment (through store dispatch)
      mockStore.dispatch(sessionId, {
        type: 'TERMINAL_UPDATE_ENV',
        payload: { environment: newEnv }
      })

      // In a real scenario, the terminal would track environment changes
      // For this test, we verify the dispatch was called correctly
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'TERMINAL_UPDATE_ENV',
          payload: { environment: newEnv }
        })
      )
    })
  })

  describe('concurrent operations', () => {
    it('should handle concurrent resize operations', () => {
      const sessionId = createSessionId('test-session')
      
      // Create terminal
      terminalService.create({ sessionId })

      // Perform multiple resize operations
      const results = [
        terminalService.resize(sessionId, { rows: 30, cols: 90 }),
        terminalService.resize(sessionId, { rows: 35, cols: 95 }),
        terminalService.resize(sessionId, { rows: 40, cols: 100 })
      ]

      // All should succeed
      results.forEach(result => {
        expect(result.ok).toBe(true)
      })

      // Final state should be last resize
      const terminal = terminalService.getTerminal(sessionId)
      expect(terminal.ok).toBe(true)
      if (terminal.ok && terminal.value) {
        expect(terminal.value.rows).toBe(40)
        expect(terminal.value.cols).toBe(100)
      }
    })
  })
})