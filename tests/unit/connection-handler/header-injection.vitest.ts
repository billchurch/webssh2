// tests/unit/connection/ssh-validator.vitest.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getConfig } from '../../../app/config'
import handleConnection, { buildTempConfig } from '../../../app/connectionHandler'
import { createDefaultConfig } from '../../../app/config/config-processor'
import { backup } from 'node:sqlite'
import { Request } from 'express'

const dummyHost = '192.0.2.1'

// --- helpers ---
function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    path: '/host/',
    protocol: 'https',
    get: (key: string) => (key === 'host' ? 'localhost:3000' : undefined),
    session: {
      sshCredentials: {
        host: dummyHost,
        port: 22,
        term: 'xterm',
      },
      usedBasicAuth: false,
      authMethod: 'password',
      headerOverride: null,
    },
    sessionID: 'test-session-id',
    ...overrides,
  }
}

const defaultConfig = createDefaultConfig()

// --- tests ---
describe('handleConnection - tempConfig.header', () => {
  it('omits header when config is default and no session override', async () => {
    const req = makeReq()
    const tmpcfg = buildTempConfig(req as any, defaultConfig)
    expect(tmpcfg.header).toMatchObject({ text: null, background: 'green' })
  })

  it('sets header.text from config when present', async () => {
    const req = makeReq()
    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, text: 'Test header' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toMatchObject({ text: 'Test header', background: 'green' })
  })

  it('sets header.background from config when non-default', async () => {
    const req = makeReq()
    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, background: '#ff00aa' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toMatchObject({ text: null, background: '#ff00aa' })
  })

  it('session headerOverride.text wins over config.header.text', async () => {
    const req = makeReq({
      session: {
        sshCredentials: {
          host: dummyHost,
          port: 22,
          term: 'xterm',
        },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: {
          text: 'Text from session',
        },
      },
    })

    const cfg = {
      ...defaultConfig,
      header: { text: 'Text from config', background: '#ff00aa' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toMatchObject({ text: 'Text from session', background: '#ff00aa' })
  })

  it('session headerOverride.background wins over config.header.background', async () => {
    const req = makeReq({
      session: {
        sshCredentials: {
          host: dummyHost,
          port: 22,
          term: 'xterm',
        },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: {
          background: '#125325',
        },
      },
    })

    const cfg = {
      ...defaultConfig,
      header: { text: 'Text from config', background: '#ff00aa' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toMatchObject({ text: 'Text from config', background: '#125325' })
  })

  it('partial override merges: text from override, background from config', async () => {
    const req = makeReq({
      session: {
        sshCredentials: {
          host: dummyHost,
          port: 22,
          term: 'xterm',
        },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: {
          text: 'Text from session',
        },
      },
    })

    const cfg = {
      ...defaultConfig,
      header: { text: 'Text from config', background: '#ff00aa' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toMatchObject({ text: 'Text from session', background: '#ff00aa' })
  })

  it('invalid override text values (undefined) do not appear in header', async () => {
    const req = makeReq({
      session: {
        sshCredentials: {
          host: dummyHost,
          port: 22,
          term: 'xterm',
        },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: {
          text: undefined,
        },
      },
    })

    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, text: 'Text from config' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toMatchObject({ text: 'Text from config', background: 'green' })
  })

  it('invalid override text values (null) do not appear in header', async () => {
    const req = makeReq({
      session: {
        sshCredentials: {
          host: dummyHost,
          port: 22,
          term: 'xterm',
        },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: {
          text: null,
        },
      },
    })

    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, text: 'Text from config' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toMatchObject({ text: 'Text from config', background: 'green' })
  })

  it('invalid override background values (undefined) do not appear in header', async () => {
    const req = makeReq({
      session: {
        sshCredentials: {
          host: dummyHost,
          port: 22,
          term: 'xterm',
        },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: {
          background: undefined,
        },
      },
    })

    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, background: '#123456' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toMatchObject({ text: null, background: '#123456' })
  })

  it('invalid override background values (null) do not appear in header', async () => {
    const req = makeReq({
      session: {
        sshCredentials: {
          host: dummyHost,
          port: 22,
          term: 'xterm',
        },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: {
          background: null,
        },
      },
    })

    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, background: '#123456' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toMatchObject({ text: null, background: '#123456' })
  })

  it('background #000 with no override omits header', async () => {
    const req = makeReq()

    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, background: '#000' },
    }
    const tmpcfg = buildTempConfig(req as any, cfg)
    expect(tmpcfg.header).toEqual(undefined)
  })
})
