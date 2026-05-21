import { describe, it, expect } from 'vitest'
import { processHeaderParameters, type AuthSession } from '../../../app/auth/auth-utils.js'

describe('processHeaderParameters', () => {
  it('sets headerOverride on session when source has header values', () => {
    const session: AuthSession = {}
    processHeaderParameters({ header: 'hello', headerBackground: 'green' }, session)
    expect(session.headerOverride).toEqual({ text: 'hello', background: 'green' })
  })

  it('replaces (does not merge) existing headerOverride from prior request', () => {
    const session: AuthSession = {
      headerOverride: { text: 'old', background: 'red' }
    }
    processHeaderParameters({ header: 'new' }, session)
    // Critical: background from prior request must NOT persist
    expect(session.headerOverride).toEqual({ text: 'new' })
  })

  it('clears headerOverride when current request has no header values', () => {
    const session: AuthSession = {
      headerOverride: { text: 'stale', background: 'red' }
    }
    processHeaderParameters({}, session)
    expect(session.headerOverride).toBeUndefined()
  })

  it('clears headerOverride when source is undefined', () => {
    const session: AuthSession = {
      headerOverride: { text: 'stale' }
    }
    processHeaderParameters(undefined, session)
    expect(session.headerOverride).toBeUndefined()
  })

  it('handles fresh session (no prior override) with no source', () => {
    const session: AuthSession = {}
    processHeaderParameters(undefined, session)
    expect(session.headerOverride).toBeUndefined()
  })
})
