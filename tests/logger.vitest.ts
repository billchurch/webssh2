import { describe, it, expect, vi } from 'vitest'
import { createNamespacedDebug, logError } from '../app/logger.js'

describe('logger.ts', () => {
  it('creates namespaced debug', () => {
    const d = createNamespacedDebug('test')
    expect(d).toBeTypeOf('function')
  })

  it('logError prints message and error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('msg')
    logError('msg2', new Error('boom'))
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
