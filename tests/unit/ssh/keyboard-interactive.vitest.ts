// tests/unit/ssh/keyboard-interactive.vitest.ts
// Tests for keyboard-interactive authentication handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { TEST_USERNAME, TEST_PASSWORD, TEST_PASSWORDS } from '../../test-constants.js'

// Test helpers for reducing duplication
interface KeyboardInteractivePrompt {
  prompt: string
  echo: boolean
}

interface KeyboardInteractiveTestParams {
  name?: string
  instructions?: string
  instructionsLang?: string
  prompts?: KeyboardInteractivePrompt[] | null
}

const createKeyboardInteractiveTest = (
  client: MockSSHClient,
  params: KeyboardInteractiveTestParams = {}
): Promise<string[]> => {
  return new Promise<string[]>((resolve) => {
    const finishMock = vi.fn((responses: string[]) => {
      resolve(responses)
    })
    
    client.conn.emit('keyboard-interactive',
      params.name ?? 'SSH Server',
      params.instructions ?? 'Please authenticate',
      params.instructionsLang ?? 'en',
      'prompts' in params ? params.prompts : [{ prompt: 'Password: ', echo: false }],
      finishMock
    )
  })
}

const expectKeyboardInteractiveEvent = (
  client: MockSSHClient
): Promise<any> => {
  return new Promise<any>((resolve) => {
    client.on('keyboard-interactive', resolve)
  })
}

// Mock SSH2 connection
class MockConnection extends EventEmitter {
  shell = vi.fn((callback: (err: Error | null, stream?: any) => void) => {
    const stream = new EventEmitter()
    callback(null, stream)
    return stream
  })
  
  end = vi.fn()
  
  on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener)
    return this
  }
}

// Mock SSH client that simulates keyboard-interactive auth
class MockSSHClient extends EventEmitter {
  conn: MockConnection
  creds: { username?: string; password?: string } = {}
  
  constructor() {
    super()
    this.conn = new MockConnection()
    
    // Set up keyboard-interactive handler like in app/ssh.ts
    this.conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      const password = this.creds?.password

      if (password != null && typeof password === 'string' && Array.isArray(prompts)) {
        const responses: string[] = []
        for (let i = 0; i < prompts.length; i++) {
          responses.push(password)
        }
        if (typeof finish === 'function') {
          finish(responses)
        }
      } else {
        this.emit('keyboard-interactive', { name, instructions, instructionsLang, prompts })
        if (typeof finish === 'function') {
          finish([])
        }
      }
    })
  }
  
  connect(creds: { username: string; password?: string }) {
    this.creds = creds
    // Simulate connection and keyboard-interactive auth flow
    setImmediate(() => {
      this.conn.emit('ready')
    })
  }
}

describe('Keyboard-Interactive Authentication', () => {
  let client: MockSSHClient
  
  beforeEach(() => {
    client = new MockSSHClient()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  it('should handle keyboard-interactive auth with password', async () => {
    client.creds = {
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }
    
    const responses = await createKeyboardInteractiveTest(client, {
      instructions: 'Please enter your password'
    })
    
    expect(responses).toHaveLength(1)
    expect(responses[0]).toBe(TEST_PASSWORD)
  })
  
  it('should handle multiple prompts with same password', async () => {
    client.creds = {
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }
    
    const responses = await createKeyboardInteractiveTest(client, {
      name: 'Multi-factor Auth',
      instructions: 'Answer all prompts',
      prompts: [
        { prompt: 'Password: ', echo: false },
        { prompt: 'Confirm Password: ', echo: false },
        { prompt: 'PIN: ', echo: false }
      ]
    })
    
    expect(responses).toHaveLength(3)
    expect(responses).toEqual([TEST_PASSWORD, TEST_PASSWORD, TEST_PASSWORD])
  })
  
  it('should emit event when no password available', async () => {
    // No password set
    client.creds = {
      username: TEST_USERNAME
    }
    
    const eventPromise = expectKeyboardInteractiveEvent(client)
    const responsePromise = createKeyboardInteractiveTest(client, {
      instructions: 'Please enter your password'
    })
    
    const [eventData, responses] = await Promise.all([eventPromise, responsePromise])
    
    expect(eventData.name).toBe('SSH Server')
    expect(eventData.prompts).toHaveLength(1)
    expect(responses).toHaveLength(0)
  })
  
  it('should handle null/undefined prompts gracefully', async () => {
    client.creds = {
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }
    
    const responses = await createKeyboardInteractiveTest(client, {
      instructions: 'No prompts',
      prompts: null
    })
    
    expect(responses).toHaveLength(0)
  })
  
  it('should handle empty prompts array', async () => {
    client.creds = {
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }
    
    const responses = await createKeyboardInteractiveTest(client, {
      instructions: 'No prompts',
      prompts: []
    })
    
    expect(responses).toHaveLength(0)
  })
  
  it('should handle missing finish callback', () => {
    const eventHandler = vi.fn()
    
    client.creds = {
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }
    
    // Since password is set, event should NOT be emitted
    client.on('keyboard-interactive', eventHandler)
    
    // Call without finish callback - should not throw
    expect(() => {
      client.conn.emit('keyboard-interactive',
        'SSH Server',
        'Test',
        'en',
        [{ prompt: 'Password: ', echo: false }],
        undefined
      )
    }).not.toThrow()
    
    // Event should NOT be emitted when password is available
    expect(eventHandler).not.toHaveBeenCalled()
  })
  
  it('should emit event when finish is missing and no password', () => {
    const eventHandler = vi.fn()
    
    // No password set
    client.creds = {
      username: TEST_USERNAME
    }
    
    client.on('keyboard-interactive', eventHandler)
    
    // Call without finish callback - should not throw
    expect(() => {
      client.conn.emit('keyboard-interactive',
        'SSH Server',
        'Test',
        'en',
        [{ prompt: 'Password: ', echo: false }],
        undefined
      )
    }).not.toThrow()
    
    // Event SHOULD be emitted when no password
    expect(eventHandler).toHaveBeenCalledTimes(1)
    expect(eventHandler).toHaveBeenCalledWith({
      name: 'SSH Server',
      instructions: 'Test',
      instructionsLang: 'en',
      prompts: [{ prompt: 'Password: ', echo: false }]
    })
  })
  
  it('should handle various password types from TEST_PASSWORDS', async () => {
    const testPassword = TEST_PASSWORDS.secret
    client.creds = {
      username: TEST_USERNAME,
      password: testPassword
    }
    
    const responses = await createKeyboardInteractiveTest(client, {
      instructions: 'Enter password'
    })
    
    expect(responses).toHaveLength(1)
    expect(responses[0]).toBe(testPassword)
  })
  
  it('should not send password when it is not a string', async () => {
    // Set password to non-string value
    client.creds = {
      username: TEST_USERNAME,
      password: 123 as any // Invalid type
    }
    
    const eventPromise = expectKeyboardInteractiveEvent(client)
    const responsePromise = createKeyboardInteractiveTest(client, {
      instructions: 'Enter password'
    })
    
    const [eventData, responses] = await Promise.all([eventPromise, responsePromise])
    
    expect(eventData.name).toBe('SSH Server')
    expect(responses).toHaveLength(0)
  })
  
  it('should handle finish callback that is not a function', () => {
    client.creds = {
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }
    
    // Should not throw with non-function finish
    expect(() => {
      client.conn.emit('keyboard-interactive',
        'SSH Server',
        'Test',
        'en',
        [{ prompt: 'Password: ', echo: false }],
        'not-a-function' as any
      )
    }).not.toThrow()
  })
})

describe('Keyboard-Interactive Auth Regression Tests', () => {
  it('should automatically respond to password prompts (fix for #409)', async () => {
    // This test verifies the fix for issue #409 where keyboard-interactive
    // auth was timing out because WebSSH2 wasn't responding to prompts
    
    const client = new MockSSHClient()
    
    // Set credentials like a normal connection
    client.creds = {
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }
    
    const responses = await createKeyboardInteractiveTest(client, {
      name: 'SSH Authentication',
      instructions: 'Please authenticate'
    })
    
    // The key fix: WebSSH2 now automatically responds with the password
    expect(responses).toHaveLength(1)
    expect(responses[0]).toBe(TEST_PASSWORD)
  })
  
  it('should handle keyboard-interactive without hanging (v0.4.6 compatibility)', async () => {
    // Test that we maintain compatibility with v0.4.6 behavior
    const client = new MockSSHClient()
    
    // No password - should emit event for client-side handling
    client.creds = {
      username: TEST_USERNAME
    }
    
    const eventPromise = expectKeyboardInteractiveEvent(client)
    const responsePromise = createKeyboardInteractiveTest(client, {
      instructions: 'Manual authentication required',
      prompts: [{ prompt: 'Token: ', echo: true }]
    })
    
    const [eventData, responses] = await Promise.all([eventPromise, responsePromise])
    
    // Without password, should emit event but still call finish
    expect(responses).toHaveLength(0)
    expect(eventData).toBeDefined()
    expect(eventData.name).toBe('SSH Server')
  })
})