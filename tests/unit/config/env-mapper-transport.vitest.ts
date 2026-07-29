import { describe, expect, it, vi } from 'vitest'
import { mapEnvironmentVariables } from '../../../app/config/env-mapper.js'

const getTransport = (config: Record<string, unknown>): unknown =>
  (config['options'] as Record<string, unknown> | undefined)?.['transport']

describe('WEBSSH2_OPTIONS_TRANSPORT mapping', () => {
  it('maps a valid comma list to options.transport, normalized', () => {
    const config = mapEnvironmentVariables({
      WEBSSH2_OPTIONS_TRANSPORT: ' Polling , WEBSOCKET '
    })
    expect(getTransport(config)).toEqual(['polling', 'websocket'])
  })

  it('omits options.transport when the env var is unset', () => {
    const config = mapEnvironmentVariables({})
    expect(getTransport(config)).toBeUndefined()
  })

  it('omits options.transport and fires the warning hook on invalid input', () => {
    const onTransportWarning = vi.fn()
    const config = mapEnvironmentVariables(
      { WEBSSH2_OPTIONS_TRANSPORT: 'smtp,gopher' },
      { onTransportWarning }
    )
    expect(getTransport(config)).toBeUndefined()
    expect(onTransportWarning).toHaveBeenCalledOnce()
  })

  it('never emits an empty array', () => {
    const config = mapEnvironmentVariables({ WEBSSH2_OPTIONS_TRANSPORT: '' })
    expect(getTransport(config)).toBeUndefined()
  })
})
