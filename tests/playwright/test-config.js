// Shared test configuration for Playwright E2E
export const WEB_PORT = Number(process.env.E2E_WEB_PORT || 2222)
export const SSH_PORT = Number(process.env.E2E_SSH_PORT || 2244)
export const BASE_URL = `http://localhost:${WEB_PORT}`
export const SSH_HOST = 'localhost'
export const USERNAME = process.env.E2E_SSH_USER || 'testuser'
export const PASSWORD = process.env.E2E_SSH_PASS || 'testpassword'

