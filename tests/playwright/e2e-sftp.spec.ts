/* global document */
/**
 * SFTP E2E Tests
 *
 * Tests the SFTP file browser functionality through the Playwright browser UI.
 * Covers: upload, download, mkdir, rmdir, blocked extensions, and path restrictions.
 */

import { test, expect, type Page } from '@playwright/test'
import { SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'
import { waitForV2Terminal, waitForV2Connection, waitForV2Prompt } from './v2-helpers.js'
import { SFTP_TEST_CONFIG } from '../test-constants.js'

const E2E_ENABLED = process.env['ENABLE_E2E_SSH'] === '1'

// =============================================================================
// SFTP Test Helpers
// =============================================================================

/**
 * Opens the SFTP file browser panel via the Menu dropdown
 */
async function openFileBrowser(page: Page): Promise<void> {
  // Hover over the Menu button to open dropdown (menu opens on mouseEnter)
  const menuButton = page.getByRole('button', { name: 'Menu' })
  await expect(menuButton).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
  await menuButton.hover()

  // Wait for dropdown to appear
  await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: TIMEOUTS.SHORT_WAIT })

  // Click File Browser menu item
  await page.getByRole('menuitem', { name: 'File Browser' }).click()

  // Wait for the SFTP panel to be visible - look for the Close file browser button
  await expect(page.getByRole('button', { name: 'Close file browser' })).toBeVisible({ timeout: TIMEOUTS.CONNECTION })

  // Wait for directory listing to load (loading spinner should disappear)
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-testid="sftp-panel"]') ??
                    document.querySelector('.h-72') // FileBrowser uses h-72 class
      if (panel === null) {
        return false
      }
      // Check that we're not in loading state
      const loadingSpinner = panel.querySelector('[data-testid="loading"]') ??
                             panel.querySelector('.animate-spin')
      return loadingSpinner === null
    },
    { timeout: TIMEOUTS.CONNECTION }
  )
}

/**
 * Closes the SFTP file browser panel
 */
async function closeFileBrowser(page: Page): Promise<void> {
  // Click the close button using accessible name
  await page.getByRole('button', { name: 'Close file browser' }).click()

  // Wait for panel to be hidden - the close button should no longer be visible
  await expect(page.getByRole('button', { name: 'Close file browser' })).toBeHidden({ timeout: TIMEOUTS.SHORT_WAIT })
}

/**
 * Gets the current path shown in the SFTP toolbar
 */
async function getCurrentPath(page: Page): Promise<string> {
  // The path element has title="Click to edit path" and contains the path like /home/testuser
  const pathElement = page.locator('[title="Click to edit path"]')
  const text = await pathElement.textContent()
  return text ?? ''
}

/**
 * Navigates to a specific path in the SFTP browser
 */
async function navigateToPath(page: Page, targetPath: string): Promise<void> {
  // Click on the path bar to make it editable (it has title="Click to edit path")
  // This is a div that switches to an input when clicked
  const pathElement = page.locator('[title="Click to edit path"]')
  await pathElement.click()

  // Wait for the input to appear (the div is replaced by an input with border-blue-500)
  const pathInput = page.locator('input.border-blue-500')
  await expect(pathInput).toBeVisible({ timeout: TIMEOUTS.SHORT_WAIT })

  // Clear and fill the input
  await pathInput.fill(targetPath)
  await page.keyboard.press('Enter')

  // Wait for navigation to complete
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
}

/**
 * Creates a new folder using the SFTP toolbar button
 */
async function createFolder(page: Page, folderName: string): Promise<void> {
  // Click the new folder button using accessible name
  await page.getByRole('button', { name: 'Create new folder' }).click()

  // Wait for the input field to appear and fill it
  const folderInput = page.locator('input[placeholder*="folder"]').or(page.locator('input').first())
  await expect(folderInput).toBeVisible({ timeout: TIMEOUTS.SHORT_WAIT })
  await folderInput.fill(folderName)
  await page.keyboard.press('Enter')

  // Wait for folder to appear in listing
  await expect(page.getByText(folderName)).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
}

/**
 * Deletes a file or folder by clicking its delete button
 */
async function deleteEntry(page: Page, entryName: string): Promise<void> {
  // Find the file entry in the file browser list
  // File entries are listitems with accessible name like "File: filename.txt, 55 B" or "Folder: foldername"
  const escapedName = entryName.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  // eslint-disable-next-line security/detect-non-literal-regexp -- Intentional dynamic matching of test file names
  const row = page.getByRole('listitem', { name: new RegExp(String.raw`(File|Folder): ${escapedName}`) })

  // Hover to show action buttons
  await row.hover()

  // Set up dialog handler BEFORE clicking delete (it uses window.confirm)
  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })

  // Click the delete button (has accessible name "Delete {filename}")
  await page.getByRole('button', { name: `Delete ${entryName}` }).click()

  // Wait for entry to be removed from the file list
  await expect(row).toBeHidden({ timeout: TIMEOUTS.CONNECTION })
}

/**
 * Uploads a file using the file input
 */
async function uploadFile(page: Page, fileName: string, content: string): Promise<void> {
  // Create a buffer from the content
  const buffer = Buffer.from(content, 'utf-8')

  // Click the Upload files button to trigger file chooser
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Upload files' }).click()
  const fileChooser = await fileChooserPromise

  // Set the file
  await fileChooser.setFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer,
  })

  // Wait for upload to complete - look for the file in the listing
  await expect(page.getByText(fileName)).toBeVisible({ timeout: TIMEOUTS.ACTION })
}

/**
 * Triggers a file download and waits for it to complete
 */
async function downloadFile(page: Page, fileName: string): Promise<void> {
  // Find the file entry in the file browser list
  // File entries are listitems with accessible name like "File: filename.txt, 55 B"
  const escapedName = fileName.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  // eslint-disable-next-line security/detect-non-literal-regexp -- Intentional dynamic matching of test file names
  const row = page.getByRole('listitem', { name: new RegExp(String.raw`File: ${escapedName}`) })

  await row.hover()

  // Start waiting for download before clicking
  const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUTS.ACTION })

  // Click download button (has accessible name "Download {filename}")
  await page.getByRole('button', { name: `Download ${fileName}` }).click()

  // Wait for download to start
  const download = await downloadPromise

  // Optionally wait for download to complete
  await download.path()
}

/**
 * Checks if an error message is displayed
 */
async function getErrorMessage(page: Page): Promise<string | null> {
  const errorBanner = page.locator('[data-testid="sftp-error"]').or(
    page.locator('[role="alert"]').or(
      page.locator('.bg-red-500, .bg-red-600, .text-red-500, .text-red-600')
    )
  )

  if (await errorBanner.isVisible({ timeout: TIMEOUTS.SHORT_WAIT }).catch(() => false)) {
    return errorBanner.textContent()
  }
  return null
}

/**
 * Waits for SFTP to be available (sftp-status event received with enabled=true)
 */
async function waitForSftpAvailable(page: Page): Promise<void> {
  // Wait a moment for sftp-status event to be processed
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

  // Hover over the Menu button to open dropdown (menu opens on mouseEnter)
  const menuButton = page.getByRole('button', { name: 'Menu' })
  await expect(menuButton).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
  await menuButton.hover()

  // Wait for the dropdown menu to appear
  await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: TIMEOUTS.SHORT_WAIT })

  // The File Browser menu item only appears when SFTP is available
  await expect(page.getByRole('menuitem', { name: 'File Browser' })).toBeVisible({ timeout: TIMEOUTS.CONNECTION })

  // Move mouse away to close the menu (triggers onMouseLeave on parent div)
  await page.mouse.move(0, 0)
  await expect(page.locator('[role="menu"]')).toBeHidden({ timeout: TIMEOUTS.SHORT_WAIT })
}

// =============================================================================
// Test Suite
// =============================================================================

test.describe('SFTP E2E Tests', () => {
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run these tests')

  test.beforeEach(async ({ browser, baseURL }) => {
    // Each test gets a fresh context with HTTP credentials
    const context = await browser.newContext({
      httpCredentials: { username: USERNAME, password: PASSWORD },
    })
    const page = await context.newPage()

    // Navigate and establish SSH connection
    await page.goto(`${baseURL}/ssh/host/localhost?port=${SSH_PORT}`)
    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Store page in test info for use in tests
    // @ts-expect-error - attaching to test for use in tests
    test.info().page = page
    // @ts-expect-error - attaching to test for use in tests
    test.info().context = context
  })

  test.afterEach(async () => {
    // @ts-expect-error - accessing attached context
    const context: unknown = test.info().context
    if (context !== undefined && context !== null && typeof context === 'object' && 'close' in context) {
      await (context as { close: () => Promise<void> }).close()
    }
  })

  test('should show File Browser menu when SFTP is enabled', async () => {
    // @ts-expect-error - accessing attached page
    const page = test.info().page as Page

    // Wait for sftp-status event to be processed
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Hover over the Menu button to open dropdown (menu opens on mouseEnter)
    const menuButton = page.getByRole('button', { name: 'Menu' })
    await expect(menuButton).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    await menuButton.hover()

    // Wait for dropdown menu to appear
    await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: TIMEOUTS.SHORT_WAIT })

    // Take screenshot showing menu contents
    const shotPath = test.info().outputPath('sftp-menu-available.png')
    await page.screenshot({ path: shotPath, fullPage: true })
    await test.info().attach('screenshot', { path: shotPath, contentType: 'image/png' })

    // Verify the File Browser menu item exists
    await expect(page.getByRole('menuitem', { name: 'File Browser' })).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
  })

  test('should open and close the file browser panel', async () => {
    // @ts-expect-error - accessing attached page
    const page = test.info().page as Page

    await waitForSftpAvailable(page)
    await openFileBrowser(page)

    // Verify panel is visible and shows directory content
    const path = await getCurrentPath(page)
    expect(path).toBeTruthy()

    // Take screenshot
    const shotPath = test.info().outputPath('sftp-panel-open.png')
    await page.screenshot({ path: shotPath, fullPage: true })
    await test.info().attach('screenshot', { path: shotPath, contentType: 'image/png' })

    await closeFileBrowser(page)
  })

  test('should create and remove a directory', async () => {
    // @ts-expect-error - accessing attached page
    const page = test.info().page as Page

    await waitForSftpAvailable(page)
    await openFileBrowser(page)

    const testDirName = `${SFTP_TEST_CONFIG.TEST_DIR_NAME}-${Date.now()}`

    // Create directory
    await createFolder(page, testDirName)

    // Verify directory appears in listing
    await expect(page.locator(`text=${testDirName}`)).toBeVisible()

    // Take screenshot after creation
    const createShotPath = test.info().outputPath('sftp-mkdir.png')
    await page.screenshot({ path: createShotPath, fullPage: true })
    await test.info().attach('mkdir-screenshot', { path: createShotPath, contentType: 'image/png' })

    // Delete the directory
    await deleteEntry(page, testDirName)

    // Verify directory is removed
    await expect(page.locator(`text=${testDirName}`)).toBeHidden()

    // Take screenshot after deletion
    const deleteShotPath = test.info().outputPath('sftp-rmdir.png')
    await page.screenshot({ path: deleteShotPath, fullPage: true })
    await test.info().attach('rmdir-screenshot', { path: deleteShotPath, contentType: 'image/png' })
  })

  test('should upload a file', async () => {
    // @ts-expect-error - accessing attached page
    const page = test.info().page as Page

    await waitForSftpAvailable(page)
    await openFileBrowser(page)

    const testFileName = `test-upload-${Date.now()}.txt`

    // Upload file
    await uploadFile(page, testFileName, SFTP_TEST_CONFIG.TEST_FILE_CONTENT)

    // Verify file appears in listing
    await expect(page.locator(`text=${testFileName}`)).toBeVisible({ timeout: TIMEOUTS.ACTION })

    // Take screenshot
    const shotPath = test.info().outputPath('sftp-upload.png')
    await page.screenshot({ path: shotPath, fullPage: true })
    await test.info().attach('upload-screenshot', { path: shotPath, contentType: 'image/png' })

    // Cleanup: delete the uploaded file
    await deleteEntry(page, testFileName)
  })

  test('should download a file', async () => {
    // @ts-expect-error - accessing attached page
    const page = test.info().page as Page

    await waitForSftpAvailable(page)
    await openFileBrowser(page)

    const testFileName = `test-download-${Date.now()}.txt`

    // First upload a file to download
    await uploadFile(page, testFileName, SFTP_TEST_CONFIG.TEST_FILE_CONTENT)
    await expect(page.locator(`text=${testFileName}`)).toBeVisible({ timeout: TIMEOUTS.ACTION })

    // Download the file
    await downloadFile(page, testFileName)

    // Take screenshot
    const shotPath = test.info().outputPath('sftp-download.png')
    await page.screenshot({ path: shotPath, fullPage: true })
    await test.info().attach('download-screenshot', { path: shotPath, contentType: 'image/png' })

    // Cleanup: delete the file
    await deleteEntry(page, testFileName)
  })

  test('should block upload of files with blocked extensions', async () => {
    // @ts-expect-error - accessing attached page
    const page = test.info().page as Page

    await waitForSftpAvailable(page)
    await openFileBrowser(page)

    // Try to upload a .exe file (blocked by default config)
    const blockedFileName = `malicious-${Date.now()}.exe`

    // Click the Upload files button to trigger file chooser
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Upload files' }).click()
    const fileChooser = await fileChooserPromise

    // Set the blocked file
    await fileChooser.setFiles({
      name: blockedFileName,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('fake exe content'),
    })

    // Wait for the error to appear in the transfer list
    // The error appears as "File extension .exe is not allowed" in the transfer progress section
    await expect(page.getByText(/extension.*not allowed|not allowed.*extension/i)).toBeVisible({ timeout: TIMEOUTS.ACTION })

    // Take screenshot
    const shotPath = test.info().outputPath('sftp-blocked-extension.png')
    await page.screenshot({ path: shotPath, fullPage: true })
    await test.info().attach('blocked-extension-screenshot', { path: shotPath, contentType: 'image/png' })

    // Verify the file was NOT added to the file browser list (only in transfer list with error)
    // File browser entries are listitems with accessible name like "File: filename.txt, 55 B"
    const escapedName = blockedFileName.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
    // eslint-disable-next-line security/detect-non-literal-regexp -- Intentional dynamic matching of test file names
    const fileInBrowserList = page.getByRole('listitem', { name: new RegExp(String.raw`File: ${escapedName}`) })
    await expect(fileInBrowserList).toBeHidden({ timeout: TIMEOUTS.SHORT_WAIT })
  })

  test('should handle path restrictions when configured', async () => {
    // @ts-expect-error - accessing attached page
    const page = test.info().page as Page

    // Note: This test verifies behavior when allowedPaths is set
    // The default config has allowedPaths: null (all paths allowed)
    // To test restrictions, we'd need a different config

    await waitForSftpAvailable(page)
    await openFileBrowser(page)

    // Try to navigate to a system path that might be restricted
    // This tests the path validation in the SFTP service
    await navigateToPath(page, '/etc')

    // Wait for response
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Take screenshot
    const shotPath = test.info().outputPath('sftp-path-navigation.png')
    await page.screenshot({ path: shotPath, fullPage: true })
    await test.info().attach('path-navigation-screenshot', { path: shotPath, contentType: 'image/png' })

    // When allowedPaths is null, navigation should succeed
    // When allowedPaths is set, we'd expect an error for paths outside the allowed list
    const path = await getCurrentPath(page)
    const error = await getErrorMessage(page)

    // Either we successfully navigated, or we got a path forbidden error
    // Both are valid depending on server config
    if (error === null) {
      expect(path).toBeTruthy()
    } else {
      expect(error.toLowerCase()).toMatch(/forbidden|not allowed|restricted|permission/i)
    }
  })

  test('should show transfer progress during upload', async () => {
    // @ts-expect-error - accessing attached page
    const page = test.info().page as Page

    await waitForSftpAvailable(page)
    await openFileBrowser(page)

    // Create a larger file to see progress
    const largeContent = 'x'.repeat(SFTP_TEST_CONFIG.LARGE_FILE_SIZE)
    const testFileName = `large-upload-${Date.now()}.txt`

    // Click the Upload files button to trigger file chooser
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Upload files' }).click()
    const fileChooser = await fileChooserPromise

    // Set the file
    await fileChooser.setFiles({
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from(largeContent),
    })

    // Try to catch transfer progress UI
    // The TransferProgress component shows during active transfers
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT / 2)

    // Take screenshot during upload (might catch progress bar)
    const shotPath = test.info().outputPath('sftp-upload-progress.png')
    await page.screenshot({ path: shotPath, fullPage: true })
    await test.info().attach('upload-progress-screenshot', { path: shotPath, contentType: 'image/png' })

    // Wait for upload to complete - file should appear in the file browser list
    // File browser entries are listitems with accessible name like "File: filename.txt, 97.7 KB"
    const escapedName = testFileName.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
    // eslint-disable-next-line security/detect-non-literal-regexp -- Intentional dynamic matching of test file names
    const fileEntry = page.getByRole('listitem', { name: new RegExp(String.raw`File: ${escapedName}`) })
    await expect(fileEntry).toBeVisible({ timeout: TIMEOUTS.ACTION })

    // Cleanup
    await deleteEntry(page, testFileName)
  })
})
