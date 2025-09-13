/**
 * Centralized test constants for Playwright E2E tests
 * All test configuration should be defined here
 */

// Port configuration
export const WEB_PORT = Number(process.env.E2E_WEB_PORT || 4444)
export const SSH_PORT = Number(process.env.E2E_SSH_PORT || 4422)
export const CLIENT_DEV_PORT = 3000

// URL configuration
export const BASE_URL = `http://localhost:${WEB_PORT}`
export const CLIENT_DEV_URL = `http://localhost:${CLIENT_DEV_PORT}`

// SSH test server configuration
export const SSH_HOST = 'localhost'
export const USERNAME = process.env.E2E_SSH_USER || 'testuser'
export const PASSWORD = process.env.E2E_SSH_PASS || 'testpassword'
export const INVALID_USERNAME = 'wronguser'
export const INVALID_PASSWORD = 'wrongpass'
export const NON_EXISTENT_HOST = 'nonexistent.invalid.host'
export const INVALID_PORT = '9999'

// Docker configuration
export const DOCKER_CONTAINER = 'webssh2-e2e-sshd'
export const DOCKER_IMAGE = 'ghcr.io/billchurch/ssh_test:alpine'

// Timeout configuration (in milliseconds)
export const TIMEOUTS = {
  DEFAULT: 10000,
  NAVIGATION: 30000,
  CONNECTION: 5000,
  PROMPT_WAIT: 10000,
  SHORT_WAIT: 500,
  MEDIUM_WAIT: 2000,
  LONG_WAIT: 5000,
  ACTION: 15000,
  TEST_EXTENDED: 60000,
  DOCKER_WAIT: 20000,
  DOCKER_RETRY: 250,
  WEB_SERVER: 120000,
}

// Terminal configuration
export const TERMINAL = {
  TYPE: 'xterm-256color',
  DEFAULT_ROWS: 24,
  DEFAULT_COLS: 80,
  TEST_ROWS: 50,
  TEST_COLS: 120,
  INPUT_SELECTOR: 'textbox',
  INPUT_NAME: 'Terminal input',
}

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
}

// Helper functions
export async function waitForPrompt(page, timeout = TIMEOUTS.PROMPT_WAIT) {
  await page.waitForFunction(
    () => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return /[$#]\s*$/.test(terminalContent)
    },
    { timeout }
  )
}

export async function executeCommand(page, command) {
  await page.locator('.xterm-helper-textarea').click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
}

export async function verifyTerminalFunctionality(page, username) {
  await waitForPrompt(page)
  await executeCommand(page, 'whoami')
  await page.waitForFunction(
    (expectedUser) => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return terminalContent.includes(expectedUser)
    },
    username,
    { timeout: TIMEOUTS.CONNECTION }
  )
}