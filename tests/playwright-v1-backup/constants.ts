/**
 * Playwright-specific test constants and helper functions
 * Common constants are imported from test-constants.ts
 */

import type { Page } from '@playwright/test'
import {
  TEST_SSH,
  TEST_PORTS,
  TEST_TIMEOUTS,
  TERMINAL as TERMINAL_CONFIG,
  DOCKER_CONFIG,
  INVALID_TEST_VALUES,
} from '../test-constants.js'

// Port configuration - use from TEST_PORTS
export const WEB_PORT = TEST_PORTS.e2eWeb
export const SSH_PORT = TEST_PORTS.e2eSsh
export const CLIENT_DEV_PORT = TEST_PORTS.clientDev

// URL configuration
export const BASE_URL = `http://localhost:${WEB_PORT}`
export const CLIENT_DEV_URL = `http://localhost:${CLIENT_DEV_PORT}`

// SSH test server configuration
export const SSH_HOST = 'localhost'
export const USERNAME = process.env.E2E_SSH_USER || TEST_SSH.USERNAME
export const PASSWORD = process.env.E2E_SSH_PASS || TEST_SSH.PASSWORD

// Re-export from test-constants for backward compatibility
export const INVALID_USERNAME = INVALID_TEST_VALUES.USERNAME
export const INVALID_PASSWORD = INVALID_TEST_VALUES.PASSWORD
export const NON_EXISTENT_HOST = INVALID_TEST_VALUES.NON_EXISTENT_HOST
export const INVALID_PORT = INVALID_TEST_VALUES.INVALID_PORT

// Docker configuration - use from DOCKER_CONFIG
export const DOCKER_CONTAINER = DOCKER_CONFIG.CONTAINER
export const DOCKER_IMAGE = DOCKER_CONFIG.IMAGE

// Timeout configuration - use from TEST_TIMEOUTS
export const TIMEOUTS = {
  DEFAULT: TEST_TIMEOUTS.DEFAULT,
  NAVIGATION: TEST_TIMEOUTS.NAVIGATION,
  CONNECTION: TEST_TIMEOUTS.CONNECTION,
  PROMPT_WAIT: TEST_TIMEOUTS.PROMPT_WAIT,
  SHORT_WAIT: TEST_TIMEOUTS.SHORT_WAIT,
  MEDIUM_WAIT: TEST_TIMEOUTS.MEDIUM_WAIT,
  LONG_WAIT: TEST_TIMEOUTS.LONG_WAIT,
  ACTION: TEST_TIMEOUTS.ACTION,
  TEST_EXTENDED: TEST_TIMEOUTS.TEST_EXTENDED,
  DOCKER_WAIT: TEST_TIMEOUTS.DOCKER_WAIT,
  DOCKER_RETRY: TEST_TIMEOUTS.DOCKER_RETRY,
  WEB_SERVER: TEST_TIMEOUTS.WEB_SERVER,
} as const

// Terminal configuration - use from TERMINAL_CONFIG
export const TERMINAL = {
  TYPE: TERMINAL_CONFIG.TYPE,
  DEFAULT_ROWS: TERMINAL_CONFIG.DEFAULT_ROWS,
  DEFAULT_COLS: TERMINAL_CONFIG.DEFAULT_COLS,
  TEST_ROWS: TERMINAL_CONFIG.TEST_ROWS,
  TEST_COLS: TERMINAL_CONFIG.TEST_COLS,
  INPUT_SELECTOR: TERMINAL_CONFIG.INPUT_SELECTOR,
  INPUT_NAME: TERMINAL_CONFIG.INPUT_NAME,
} as const

// Test configuration object (for backward compatibility)
export const TEST_CONFIG = {
  baseUrl: BASE_URL,
  clientUrl: CLIENT_DEV_URL,
  sshHost: SSH_HOST,
  sshPort: String(SSH_PORT),
  validUsername: USERNAME,
  validPassword: PASSWORD,
  invalidUsername: INVALID_USERNAME,
  invalidPassword: INVALID_PASSWORD,
  nonExistentHost: NON_EXISTENT_HOST,
  invalidPort: INVALID_PORT,
} as const

// ============================================================================
// PLAYWRIGHT-SPECIFIC HELPER FUNCTIONS
// ============================================================================

export async function waitForPrompt(page: Page, timeout: number = TIMEOUTS.PROMPT_WAIT): Promise<void> {
  await page.waitForFunction(
    () => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return /[$#]\s*$/.test(terminalContent)
    },
    { timeout }
  )
}

export async function executeCommand(page: Page, command: string): Promise<void> {
  await page.locator('.xterm-helper-textarea').click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
}

export async function verifyTerminalFunctionality(page: Page, username: string): Promise<void> {
  await waitForPrompt(page)
  await executeCommand(page, 'whoami')
  await page.waitForFunction(
    (expectedUser: string) => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return terminalContent.includes(expectedUser)
    },
    username,
    { timeout: TIMEOUTS.CONNECTION }
  )
}