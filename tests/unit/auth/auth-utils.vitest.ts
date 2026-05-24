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

  it('preserves headerOverride when request has only legacy header.color (#102)', () => {
    const session: AuthSession = {
      headerOverride: { text: 'Prod', background: 'red' }
    }
    processHeaderParameters({ 'header.color': 'blue' }, session)
    expect(session.headerOverride).toEqual({ text: 'Prod', background: 'red' })
  })

  it('preserves headerOverride when request has only legacy headerStyle (#102)', () => {
    const session: AuthSession = {
      headerOverride: { text: 'Prod' }
    }
    processHeaderParameters({ headerStyle: 'bg-red-500' }, session)
    expect(session.headerOverride).toEqual({ text: 'Prod' })
  })

  it('clears headerOverride when request has zero header keys (non-header POST)', () => {
    const session: AuthSession = {
      headerOverride: { text: 'stale' }
    }
    processHeaderParameters({ username: 'alice' }, session)
    expect(session.headerOverride).toBeUndefined()
  })
})
