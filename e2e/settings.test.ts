import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { seedRubrics, seedAppViaIpc } from './helpers/seed'

const SEED_DIMENSIONS = [
  {
    name: 'Work',
    weight: 8,
    successText: 'ship features',
    constraintsText: 'no overtime',
    antiGoalsText: 'busywork',
    additionalInfo: null,
  },
  {
    name: 'Health',
    weight: 5,
    successText: 'walk daily',
    constraintsText: '',
    antiGoalsText: '',
    additionalInfo: null,
  },
]

let app: ElectronApplication
let userDataDir: string

test.beforeEach(() => {
  userDataDir = mkdtempSync(path.join(os.tmpdir(), 'roundup-settings-'))
  seedRubrics(userDataDir, SEED_DIMENSIONS)
})

test.afterEach(async () => {
  await app?.close()
  if (userDataDir && existsSync(userDataDir)) {
    rmSync(userDataDir, { recursive: true, force: true })
  }
})

async function launchAndOpenSettings() {
  const electronPath = require('electron') as string
  app = await electron.launch({
    executablePath: electronPath,
    args: [path.join(__dirname, '../out/main/index.js'), `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ROUNDUP_E2E_MOCK_ANTHROPIC: '1', ROUNDUP_E2E_NOOP_SHELL: '1' },
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await seedAppViaIpc(window, { dimensions: SEED_DIMENSIONS })
  await expect(window.locator('[data-testid="nav-rail"]')).toBeVisible({ timeout: 10_000 })
  await window.getByRole('link', { name: 'Settings' }).click()
  await expect(window.locator('[data-testid="settings-pane"]')).toBeVisible({ timeout: 5_000 })
  return window
}

test('Settings — open rubrics file + folder buttons resolve without crash', async () => {
  const window = await launchAndOpenSettings()

  // Both buttons trigger IPC; ROUNDUP_E2E_NOOP_SHELL=1 makes the main-process
  // handler a no-op so we don't actually launch the OS file browser.
  await window.locator('[data-testid="open-rubrics-file"]').click()
  await window.waitForTimeout(150)
  await expect(window.locator('[data-testid="rubrics-error"]')).toHaveCount(0)

  await window.locator('[data-testid="open-rubrics-folder"]').click()
  await window.waitForTimeout(150)
  await expect(window.locator('[data-testid="rubrics-error"]')).toHaveCount(0)
})

test('Settings — edit a dimension and save', async () => {
  const window = await launchAndOpenSettings()

  // First seeded dimension is "Work". Open its accordion and rename it.
  const trigger = window.locator('[data-testid="settings-dimensions"] button[aria-expanded]').first()
  await trigger.click()
  const nameInput = window.locator('[data-testid="dim-name-0"]')
  await expect(nameInput).toBeVisible()
  await nameInput.fill('Deep Work')

  await window.locator('[data-testid="dim-save"]').click()
  await expect(window.locator('[data-testid="dim-success"]')).toBeVisible({ timeout: 5_000 })

  // Reload and confirm persistence.
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
  await window.getByRole('link', { name: 'Settings' }).click()
  await expect(
    window.locator('[data-testid="settings-dimensions"]').getByText('Deep Work')
  ).toBeVisible({ timeout: 5_000 })
})

test('Settings — viz toggles persist across reload', async () => {
  const window = await launchAndOpenSettings()

  const heatmapSwitch = window
    .locator('[data-testid="settings-viz-toggles"] button[role="switch"]')
    .first()
  await expect(heatmapSwitch).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 })
  await heatmapSwitch.click()
  await expect(heatmapSwitch).toHaveAttribute('aria-checked', 'false')

  await window.reload()
  await window.waitForLoadState('domcontentloaded')
  await window.getByRole('link', { name: 'Settings' }).click()
  const reloaded = window
    .locator('[data-testid="settings-viz-toggles"] button[role="switch"]')
    .first()
  await expect(reloaded).toHaveAttribute('aria-checked', 'false', { timeout: 5_000 })
})
