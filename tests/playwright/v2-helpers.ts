/* eslint-env browser */
/* global document, getComputedStyle */
/**
 * Shared V2 helper functions for Playwright tests
 * Centralizes common V2-specific test operations
 */

import { expect, type Page, type Response } from '@playwright/test'
import { TIMEOUTS } from './constants.js'

/**
 * Waits for V2 terminal to be ready and interactive
 */
export async function waitForV2Terminal(page: Page, timeout = TIMEOUTS.CONNECTION): Promise<void> {
  // Wait for terminal to be ready and visible
  await expect(page.locator('.xterm-helper-textarea')).toBeVisible({ timeout })

  // Wait for terminal to be actually interactive
  await page.waitForFunction(() => {
    const textarea = document.querySelector('.xterm-helper-textarea')
    return textarea !== null && !(textarea as HTMLTextAreaElement).disabled &&
           getComputedStyle(textarea).visibility !== 'hidden' &&
           getComputedStyle(textarea).display !== 'none'
  }, { timeout })
}

/**
 * Waits for V2 connection to be established
 */
export async function waitForV2Connection(page: Page, timeout = TIMEOUTS.CONNECTION): Promise<void> {
  // V2 might not show "Connected" status immediately
  // Instead, wait for terminal to be ready
  try {
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: timeout / 2 })
  } catch {
    // Fallback: if no "Connected" status, just wait for terminal
    await waitForV2Terminal(page, timeout)
  }
}

/**
 * Waits for shell prompt to appear
 */
export async function waitForV2Prompt(page: Page, timeout = TIMEOUTS.PROMPT_WAIT): Promise<void> {
  await page.waitForFunction(
    () => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent ?? ''
      // Look for shell prompt patterns
      return /[$#%>]\s*$/.test(terminalContent) ||
             /testuser@.*[$#%>]/.test(terminalContent) ||
             terminalContent.includes('$') || terminalContent.includes('#')
    },
    { timeout }
  )
}

/**
 * Executes a command in the V2 terminal
 */
export async function executeV2Command(page: Page, command: string): Promise<void> {
  await page.locator('.xterm-helper-textarea').click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
}

/**
 * Verifies V2 terminal functionality with basic commands
 */
export async function verifyV2TerminalFunctionality(page: Page, username: string): Promise<void> {
  await waitForV2Prompt(page)
  await executeV2Command(page, 'whoami')

  // Wait for username to appear in terminal
  await page.waitForFunction(
    (expectedUser: string) => {
      const content = document.querySelector('.xterm-screen')?.textContent ?? ''
      return content.includes(expectedUser)
    },
    username,
    { timeout: TIMEOUTS.CONNECTION }
  )

  await executeV2Command(page, 'echo "V2 test successful"')

  await page.waitForFunction(
    () => {
      const content = document.querySelector('.xterm-screen')?.textContent ?? ''
      return content.includes('V2 test successful')
    },
    { timeout: TIMEOUTS.CONNECTION }
  )
}

/**
 * Waits for command output to appear in terminal
 */
export async function waitForCommandOutput(page: Page, expectedOutput: string, timeout = TIMEOUTS.CONNECTION): Promise<void> {
  await page.waitForFunction(
    (expected: string) => {
      const content = document.querySelector('.xterm-screen')?.textContent ?? ''
      return content.includes(expected)
    },
    expectedOutput,
    { timeout }
  )
}

/**
 * Gets the current terminal content
 */
export async function getTerminalContent(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('.xterm-screen')?.textContent ?? '')
}

/**
 * Checks for authentication errors in V2
 */
export async function checkForV2AuthError(page: Page, timeout = TIMEOUTS.DEFAULT): Promise<boolean> {
  const possibleErrors = [
    page.locator('text=/Authentication failed/'),
    page.locator('text=/Invalid credentials/'),
    page.locator('text=/All authentication methods failed/'),
    page.locator('text=/SSH connection error/'),
    page.locator('text=/Connection failed/'),
    page.locator('[role="status"]').filter({ hasText: /failed/i })
  ]

  for (const errorLocator of possibleErrors) {
    try {
      await expect(errorLocator.first()).toBeVisible({ timeout: timeout / possibleErrors.length })
      return true
    } catch {
      continue
    }
  }
  return false
}

/**
 * Fills in the V2 login form
 */
export async function fillV2LoginForm(page: Page, options: {
  host: string
  port: string
  username: string
  password: string
}): Promise<void> {
  await page.fill('[name="host"]', options.host)
  await page.fill('[name="port"]', options.port)
  await page.fill('[name="username"]', options.username)
  await page.fill('[name="password"]', options.password)
}

/**
 * Connects using the V2 login form
 */
export async function connectV2(page: Page, options: {
  host: string
  port: string
  username: string
  password: string
}): Promise<void> {
  await fillV2LoginForm(page, options)
  await page.click('button:has-text("Connect")')
}

/**
 * Builds a Basic Auth URL for SSH connection
 */
export function buildBasicAuthUrl(baseUrl: string, username: string, password: string, host: string, port: string | number): string {
  const basicAuth = `${username}:${password}`
  const baseUrlWithAuth = baseUrl.replace('://', `://${basicAuth}@`)
  return `${baseUrlWithAuth}/ssh/host/${host}?port=${port}`
}

/**
 * Navigates to SSH with Basic Auth and waits for connection
 */
export async function connectWithBasicAuth(page: Page, baseUrl: string, username: string, password: string, host: string, port: string | number): Promise<void> {
  const url = buildBasicAuthUrl(baseUrl, username, password, host, port)
  await page.goto(url)
  await waitForV2Connection(page)
  await waitForV2Terminal(page)
}

/**
 * Executes a command and verifies its output
 */
export async function executeAndVerifyCommand(page: Page, command: string, expectedOutput: string): Promise<void> {
  await executeV2Command(page, command)
  await expect(page.locator('.xterm-screen').filter({ hasText: expectedOutput })).toBeVisible()
}

/**
 * Connects using form and waits for terminal to be ready
 */
export async function connectAndWaitForTerminal(page: Page, options: {
  host: string
  port: string
  username: string
  password: string
}): Promise<void> {
  await connectV2(page, options)
  await waitForV2Connection(page)
  await waitForV2Terminal(page)
  await waitForV2Prompt(page)
}

/**
 * Fills form fields directly without using helper
 */
export async function fillFormDirectly(page: Page, host: string, port: string | number, username: string, password: string): Promise<void> {
  await page.fill('[name="host"]', host)
  await page.fill('[name="port"]', port.toString())
  await page.fill('[name="username"]', username)
  await page.fill('[name="password"]', password)
  await page.click('button:has-text("Connect")')
}

/**
 * Executes multiple commands and waits for their output
 */
export async function executeCommandsWithExpectedOutput(
  page: Page,
  commands: Array<{ cmd: string; expect: string }>
): Promise<void> {
  for (const { cmd, expect: expectedText } of commands) {
    await executeV2Command(page, cmd)
    await waitForCommandOutput(page, expectedText)
  }
}

/**
 * Executes a list of commands sequentially
 */
export async function executeCommandList(page: Page, commands: string[]): Promise<void> {
  for (const command of commands) {
    await executeV2Command(page, command)

    // Wait for command to complete - check for echo output
    if (command.startsWith('echo ')) {
      const expectedOutput = command.match(/"([^"]+)"/)?.[1]
      if (expectedOutput !== undefined && expectedOutput !== '') {
        await waitForCommandOutput(page, expectedOutput, TIMEOUTS.SHORT_WAIT * 2)
      }
    }
  }
}

/**
 * Tests Basic Auth error responses with expected status codes
 * Used to reduce duplication in Basic Auth error testing scenarios
 */
export async function testBasicAuthErrorResponse(
  page: Page,
  baseUrl: string,
  username: string,
  password: string,
  host: string,
  port: string | number,
  expectedStatus: number
): Promise<Response | null> {
  const url = buildBasicAuthUrl(baseUrl, username, password, host, port)
  const response = await page.goto(url, { waitUntil: 'commit' })
  expect(response?.status()).toBe(expectedStatus)
  return response
}
