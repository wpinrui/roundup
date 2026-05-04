import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import path from 'path'
import os from 'os'

/**
 * Wizard happy-path E2E. Each test launches the app with a fresh user-data
 * dir (so isSetupComplete() is false and the wizard appears) and with
 * ROUNDUP_E2E_MOCK_ANTHROPIC=1 (so verify and generateRubrics are stubbed).
 */

let app: ElectronApplication
let userDataDir: string

test.beforeEach(async () => {
  userDataDir = mkdtempSync(path.join(os.tmpdir(), 'roundup-e2e-'))
  const electronPath = require('electron') as string
  app = await electron.launch({
    executablePath: electronPath,
    args: [
      path.join(__dirname, '../out/main/index.js'),
      `--user-data-dir=${userDataDir}`,
    ],
    env: {
      ...process.env,
      ROUNDUP_E2E_MOCK_ANTHROPIC: '1',
    },
  })
})

test.afterEach(async () => {
  await app?.close()
  if (userDataDir && existsSync(userDataDir)) {
    rmSync(userDataDir, { recursive: true, force: true })
  }
})

test('wizard happy path: API key → dimensions → rubrics → Today', async () => {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Step 1
  const overlay = window.locator('[data-testid="wizard-overlay"]')
  await expect(overlay).toBeVisible({ timeout: 10_000 })
  const step1 = window.locator('[data-testid="wizard-step-1"]')
  await expect(step1).toBeVisible()

  await window.locator('[data-testid="api-key-input"]').fill('sk-ant-good-key')
  await window.locator('[data-testid="verify-button"]').click()

  // Step 2
  const step2 = window.locator('[data-testid="wizard-step-2"]')
  await expect(step2).toBeVisible({ timeout: 5_000 })

  // Fill the first dimension
  await window.locator('[data-testid="dim-name-0"]').fill('Work')
  await window.locator('[data-testid="dim-success-0"]').fill('Ship features')

  await window.locator('[data-testid="continue-button"]').click()

  // Step 3
  const step3 = window.locator('[data-testid="wizard-step-3"]')
  await expect(step3).toBeVisible({ timeout: 5_000 })

  // After rubrics generation completes the wizard dismisses and the main
  // app shows the nav rail.
  await expect(window.locator('[data-testid="nav-rail"]')).toBeVisible({ timeout: 10_000 })
  await expect(window.locator('[data-testid="wizard-overlay"]')).toBeHidden()
})
