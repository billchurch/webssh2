import { describe, it, expect, vi, afterEach } from 'vitest'
import { TEST_USERNAME, TEST_PASSWORD } from '../../../test-constants.js'
import {
  TelnetAuthenticator,
  type TelnetAuthOptions,
  type TelnetAuthState,
} from '../../../../app/services/telnet/telnet-auth.js'

// ── Helpers ──────────────────────────────────────────────────────────

function baseOptions(): TelnetAuthOptions {
  return {
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    loginPrompt: /login:\s*$/,
    passwordPrompt: /[Pp]assword:\s*$/,
    failurePattern: /Login incorrect|Access denied|Login failed/,
    expectTimeout: 10_000,
  }
}

function withoutLogin(): TelnetAuthOptions {
  return { expectTimeout: 10_000 }
}

function withoutUsername(): TelnetAuthOptions {
  return {
    loginPrompt: /login:\s*$/,
    passwordPrompt: /[Pp]assword:\s*$/,
    failurePattern: /Login incorrect|Access denied|Login failed/,
    expectTimeout: 10_000,
  }
}

function withoutPassword(): TelnetAuthOptions {
  return {
    username: TEST_USERNAME,
    loginPrompt: /login:\s*$/,
    passwordPrompt: /[Pp]assword:\s*$/,
    failurePattern: /Login incorrect|Access denied|Login failed/,
    expectTimeout: 10_000,
  }
}

function withTimeout(ms: number): TelnetAuthOptions {
  return {
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    loginPrompt: /login:\s*$/,
    passwordPrompt: /[Pp]assword:\s*$/,
    failurePattern: /Login incorrect|Access denied|Login failed/,
    expectTimeout: ms,
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('TelnetAuthenticator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test 1: Immediate pass-through when no patterns configured
  describe('immediate pass-through', () => {
    it('should enter pass-through when no loginPrompt configured', () => {
      const auth = new TelnetAuthenticator(
        withoutLogin(),
      )

      expect(auth.state).toBe('pass-through' satisfies TelnetAuthState)

      const data = Buffer.from('Welcome to the system')
      const result = auth.processData(data)

      expect(result.writeToSocket).toBeNull()
      expect(result.forwardToClient).toEqual(data)

      auth.destroy()
    })

    // Test 2: Immediate pass-through when no username configured
    it('should enter pass-through when no username configured', () => {
      const auth = new TelnetAuthenticator(
        withoutUsername(),
      )

      expect(auth.state).toBe('pass-through' satisfies TelnetAuthState)

      const data = Buffer.from('login: ')
      const result = auth.processData(data)

      expect(result.writeToSocket).toBeNull()
      expect(result.forwardToClient).toEqual(data)

      auth.destroy()
    })
  })

  // Test 3: Detect login prompt and return username to write
  describe('login prompt detection', () => {
    it('should detect login prompt and write username to socket', () => {
      const auth = new TelnetAuthenticator(baseOptions())

      const data = Buffer.from('Welcome\r\nlogin: ')
      const result = auth.processData(data)

      expect(result.writeToSocket).toEqual(
        Buffer.from(`${TEST_USERNAME}\r\n`),
      )
      // Data during auth is buffered, not forwarded
      expect(result.forwardToClient).toBeNull()

      auth.destroy()
    })
  })

  // Test 4: Detect password prompt and return password to write
  describe('password prompt detection', () => {
    it('should detect password prompt and write password to socket', () => {
      const auth = new TelnetAuthenticator(baseOptions())

      // First, send login prompt to transition to waiting-password
      auth.processData(Buffer.from('login: '))

      // Now send password prompt
      const result = auth.processData(Buffer.from('Password: '))

      expect(result.writeToSocket).toEqual(
        Buffer.from(`${TEST_PASSWORD}\r\n`),
      )
      expect(result.forwardToClient).toBeNull()

      auth.destroy()
    })
  })

  // Test 5: Detect auth failure pattern -> failed state
  describe('auth failure detection', () => {
    it('should detect failure pattern and transition to failed', () => {
      const auth = new TelnetAuthenticator(baseOptions())

      // Go through login
      auth.processData(Buffer.from('login: '))
      // Go through password
      auth.processData(Buffer.from('Password: '))

      // Server responds with failure
      const failData = Buffer.from('Login incorrect\r\n')
      const result = auth.processData(failData)

      expect(auth.state).toBe('failed' satisfies TelnetAuthState)
      // Forward failure message to client so they can see it
      expect(result.forwardToClient).toEqual(failData)
      expect(result.writeToSocket).toBeNull()

      auth.destroy()
    })
  })

  // Test 6: Successful auth flow: login -> password -> authenticated
  describe('successful auth flow', () => {
    it('should transition through login -> password -> authenticated', () => {
      vi.useFakeTimers()

      const auth = new TelnetAuthenticator(baseOptions())
      expect(auth.state).toBe('waiting-login' satisfies TelnetAuthState)

      // Login prompt
      const loginResult = auth.processData(Buffer.from('login: '))
      expect(auth.state).toBe('waiting-password' satisfies TelnetAuthState)
      expect(loginResult.writeToSocket).toEqual(
        Buffer.from(`${TEST_USERNAME}\r\n`),
      )

      // Password prompt
      const passResult = auth.processData(Buffer.from('Password: '))
      expect(auth.state).toBe('waiting-result' satisfies TelnetAuthState)
      expect(passResult.writeToSocket).toEqual(
        Buffer.from(`${TEST_PASSWORD}\r\n`),
      )

      // Server sends shell prompt (success indicator)
      const shellData = Buffer.from('user@host:~$ ')
      const shellResult = auth.processData(shellData)
      // Data is buffered during the settle delay, not forwarded yet
      expect(auth.state).toBe('waiting-result' satisfies TelnetAuthState)
      expect(shellResult.forwardToClient).toBeNull()

      // Register settle callback and advance past settle delay
      const onSettled = vi.fn()
      auth.setOnAuthSettled(onSettled)
      vi.advanceTimersByTime(500)

      expect(auth.state).toBe('authenticated' satisfies TelnetAuthState)
      expect(onSettled).toHaveBeenCalledOnce()
      // Settle callback receives all buffered data
      const buffered = onSettled.mock.calls[0]?.[0] as Buffer
      expect(buffered.toString()).toContain('user@host:~$ ')

      vi.useRealTimers()
      auth.destroy()
    })

    it('should skip password and go to waiting-result when no password', () => {
      const auth = new TelnetAuthenticator(
        withoutPassword(),
      )
      expect(auth.state).toBe('waiting-login' satisfies TelnetAuthState)

      const loginResult = auth.processData(Buffer.from('login: '))
      expect(auth.state).toBe('waiting-result' satisfies TelnetAuthState)
      expect(loginResult.writeToSocket).toEqual(
        Buffer.from(`${TEST_USERNAME}\r\n`),
      )

      auth.destroy()
    })
  })

  // Test 7: Timeout fallback
  describe('timeout behavior', () => {
    it('should transition to pass-through on timeout and flush buffered data', () => {
      vi.useFakeTimers()

      const auth = new TelnetAuthenticator(
        withTimeout(5000),
      )
      expect(auth.state).toBe('waiting-login' satisfies TelnetAuthState)

      const onTimeout = vi.fn()
      auth.startTimeout(onTimeout)

      // Send some data that does NOT match login prompt
      auth.processData(Buffer.from('Welcome to the system\r\n'))
      auth.processData(Buffer.from('Authorized users only\r\n'))

      // Advance timer past the timeout
      vi.advanceTimersByTime(5000)

      expect(auth.state).toBe('pass-through' satisfies TelnetAuthState)
      expect(onTimeout).toHaveBeenCalledOnce()
      // Callback receives all buffered data
      const buffered = onTimeout.mock.calls[0]?.[0] as Buffer
      expect(buffered.toString()).toContain('Welcome to the system')
      expect(buffered.toString()).toContain('Authorized users only')

      vi.useRealTimers()
      auth.destroy()
    })
  })

  // Test 8: Data buffered during auth is NOT forwarded to client
  describe('data buffering during auth', () => {
    it('should not forward data to client while in waiting states', () => {
      const auth = new TelnetAuthenticator(baseOptions())

      // Data before login prompt
      const result1 = auth.processData(Buffer.from('Banner message\r\n'))
      expect(result1.forwardToClient).toBeNull()

      // Login prompt data
      const result2 = auth.processData(Buffer.from('login: '))
      expect(result2.forwardToClient).toBeNull()

      // Data before password prompt
      const result3 = auth.processData(Buffer.from('some noise\r\n'))
      expect(result3.forwardToClient).toBeNull()

      auth.destroy()
    })
  })

  // Test 9: After auth completes, data forwarded to client
  describe('post-auth data forwarding', () => {
    it('should forward all data to client after authentication', () => {
      vi.useFakeTimers()

      const auth = new TelnetAuthenticator(baseOptions())

      // Complete auth
      auth.processData(Buffer.from('login: '))
      auth.processData(Buffer.from('Password: '))
      auth.processData(Buffer.from('user@host:~$ '))

      // Advance past settle delay to complete authentication
      auth.setOnAuthSettled(() => { /* no-op */ })
      vi.advanceTimersByTime(500)
      expect(auth.state).toBe('authenticated' satisfies TelnetAuthState)

      // Subsequent data should be forwarded
      const data = Buffer.from('ls -la\r\nfile1.txt\r\n')
      const result = auth.processData(data)

      expect(result.forwardToClient).toEqual(data)
      expect(result.writeToSocket).toBeNull()

      vi.useRealTimers()
      auth.destroy()
    })
  })

  // Test 10: Pass-through mode forwards all data immediately
  describe('pass-through forwarding', () => {
    it('should forward all data immediately in pass-through mode', () => {
      const auth = new TelnetAuthenticator(
        withoutLogin(),
      )
      expect(auth.state).toBe('pass-through' satisfies TelnetAuthState)

      const data1 = Buffer.from('First chunk')
      const result1 = auth.processData(data1)
      expect(result1.forwardToClient).toEqual(data1)
      expect(result1.writeToSocket).toBeNull()

      const data2 = Buffer.from('Second chunk')
      const result2 = auth.processData(data2)
      expect(result2.forwardToClient).toEqual(data2)
      expect(result2.writeToSocket).toBeNull()

      auth.destroy()
    })
  })

  // Test 11: Destroy cancels timeout
  describe('destroy', () => {
    it('should cancel timeout on destroy', () => {
      vi.useFakeTimers()

      const auth = new TelnetAuthenticator(
        withTimeout(5000),
      )
      const onTimeout = vi.fn()
      auth.startTimeout(onTimeout)

      // Destroy before timeout fires
      auth.destroy()

      // Advance past the timeout
      vi.advanceTimersByTime(10_000)

      // Callback should NOT have been called
      expect(onTimeout).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  // Additional edge cases
  describe('edge cases', () => {
    it('should handle login prompt split across multiple data chunks', () => {
      const auth = new TelnetAuthenticator(baseOptions())

      // First chunk: partial prompt
      const result1 = auth.processData(Buffer.from('logi'))
      expect(result1.writeToSocket).toBeNull()
      expect(auth.state).toBe('waiting-login' satisfies TelnetAuthState)

      // Second chunk: completes the prompt
      const result2 = auth.processData(Buffer.from('n: '))
      expect(result2.writeToSocket).toEqual(
        Buffer.from(`${TEST_USERNAME}\r\n`),
      )

      auth.destroy()
    })

    it('should not write to socket in failed state', () => {
      const auth = new TelnetAuthenticator(baseOptions())

      // Complete login + password
      auth.processData(Buffer.from('login: '))
      auth.processData(Buffer.from('Password: '))
      auth.processData(Buffer.from('Login incorrect\r\n'))
      expect(auth.state).toBe('failed' satisfies TelnetAuthState)

      // More data arrives - should forward but not write
      const data = Buffer.from('login: ')
      const result = auth.processData(data)
      expect(result.writeToSocket).toBeNull()
      expect(result.forwardToClient).toEqual(data)

      auth.destroy()
    })

    it('should cancel timeout when auth succeeds', () => {
      vi.useFakeTimers()

      const auth = new TelnetAuthenticator(
        withTimeout(5000),
      )
      const onTimeout = vi.fn()
      auth.startTimeout(onTimeout)

      // Complete auth flow
      auth.processData(Buffer.from('login: '))
      auth.processData(Buffer.from('Password: '))
      auth.processData(Buffer.from('user@host:~$ '))

      // Advance past settle delay (500ms) to trigger auth success
      auth.setOnAuthSettled(() => { /* no-op */ })
      vi.advanceTimersByTime(500)
      expect(auth.state).toBe('authenticated' satisfies TelnetAuthState)

      // Advance past original timeout
      vi.advanceTimersByTime(10_000)

      expect(onTimeout).not.toHaveBeenCalled()

      vi.useRealTimers()
      auth.destroy()
    })
  })
})
