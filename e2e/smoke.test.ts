import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import os from 'os'

/**
 * Smoke test: when setup is already complete (rubrics.md exists in userData),
 * the app shell renders directly — wizard is bypassed and the nav rail shows.
 */

let app: ElectronApplication
let userDataDir: string

test.beforeEach(() => {
  userDataDir = mkdtempSync(path.join(os.tmpdir(), 'roundup-smoke-'))
  // Pre-seed rubrics.md so isSetupComplete() returns true and the wizard
  // gate routes straight to the app shell.
  writeFileSync(path.join(userDataDir, 'rubrics.md'), '## seeded\n', 'utf8')
})

test.afterEach(async () => {
  await app?.close()
  if (userDataDir && existsSync(userDataDir)) {
    rmSync(userDataDir, { recursive: true, force: true })
  }
})

test('app launches and renders the nav rail', async () => {
  const electronPath = require('electron') as string
  app = await electron.launch({
    executablePath: electronPath,
    args: [
      path.join(__dirname, '../out/main/index.js'),
      `--user-data-dir=${userDataDir}`,
    ],
  })

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const nav = window.locator('[data-testid="nav-rail"]')
  await expect(nav).toBeVisible({ timeout: 10_000 })

  await expect(nav.getByRole('link', { name: 'Today' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'History' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible()
})
