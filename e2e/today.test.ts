import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { seedRubrics, seedAppViaIpc, todayDateString } from './helpers/seed'

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
  userDataDir = mkdtempSync(path.join(os.tmpdir(), 'roundup-today-'))
  seedRubrics(userDataDir, SEED_DIMENSIONS)
})

test.afterEach(async () => {
  await app?.close()
  if (userDataDir && existsSync(userDataDir)) {
    rmSync(userDataDir, { recursive: true, force: true })
  }
})

async function launch() {
  const electronPath = require('electron') as string
  app = await electron.launch({
    executablePath: electronPath,
    args: [path.join(__dirname, '../out/main/index.js'), `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ROUNDUP_E2E_MOCK_ANTHROPIC: '1', ROUNDUP_E2E_NOOP_SHELL: '1' },
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  return window
}

test('Today happy path: empty → save → grade → re-grade with edit', async () => {
  const window = await launch()
  await seedAppViaIpc(window, { dimensions: SEED_DIMENSIONS })

  const dayLabel = window.locator('[data-testid="day-label"]')
  await expect(dayLabel).toBeVisible({ timeout: 10_000 })
  await expect(dayLabel).toContainText('Today')

  // Empty state — input form, both buttons disabled.
  const textarea = window.locator('[data-testid="day-textarea"]')
  await expect(textarea).toBeVisible()
  const saveBtn = window.locator('[data-testid="day-save"]')
  const gradeBtn = window.locator('[data-testid="day-grade"]')
  await expect(saveBtn).toBeDisabled()
  await expect(gradeBtn).toBeDisabled()

  // Type → Save enables.
  await textarea.fill('Did some focused work and went for a walk.')
  await expect(saveBtn).toBeEnabled()
  await saveBtn.click()

  // After save, Grade enables (row exists, no diff).
  await expect(gradeBtn).toBeEnabled({ timeout: 5_000 })
  await gradeBtn.click()

  // Readout appears with the mock narrative + score + suggestions.
  await expect(window.locator('[data-testid="day-readout"]')).toBeVisible({ timeout: 10_000 })
  await expect(window.locator('[data-testid="day-narrative"]')).toContainText(/mock/i)
  await expect(window.locator('[data-testid="day-score-headline"]')).toBeVisible()
  await expect(window.locator('[data-testid="suggestions-mode"]')).toContainText(/fix/i)
  expect(await window.locator('[data-testid="suggestion-item"]').count()).toBeGreaterThan(0)

  // Click Edit entry → input form is back, with the saved text pre-filled.
  await window.locator('[data-testid="day-edit"]').click()
  await expect(textarea).toBeVisible()
  await expect(textarea).toHaveValue('Did some focused work and went for a walk.')

  // Modify text, Save (now possible because dirty), Re-grade.
  await textarea.fill('Updated entry — even more focus today.')
  await expect(saveBtn).toBeEnabled()
  await saveBtn.click()
  await expect(gradeBtn).toBeEnabled({ timeout: 5_000 })
  await expect(gradeBtn).toContainText(/re-?grade/i)
  await gradeBtn.click()

  await expect(window.locator('[data-testid="day-readout"]')).toBeVisible({ timeout: 10_000 })
  await expect(dayLabel).toContainText('Today')
  void todayDateString
})

test('Day navigation: prev disabled at the only-day bound', async () => {
  const window = await launch()
  await seedAppViaIpc(window, { dimensions: SEED_DIMENSIONS })
  await expect(window.locator('[data-testid="day-label"]')).toBeVisible({ timeout: 10_000 })

  // Only today exists — both prev and next are disabled.
  await expect(window.locator('[data-testid="day-prev"]')).toBeDisabled()
  await expect(window.locator('[data-testid="day-next"]')).toBeDisabled()
})

test('Pre-saved past day appears in nav bounds', async () => {
  const window = await launch()
  await seedAppViaIpc(window, {
    dimensions: SEED_DIMENSIONS,
    savedDay: { date: '2026-04-30', rawEntry: 'past entry' },
  })

  const prev = window.locator('[data-testid="day-prev"]')
  await expect(prev).toBeEnabled({ timeout: 10_000 })
  await prev.click()
  await expect(window.locator('[data-testid="day-label"]')).toContainText(/April 30/i)
  await expect(window.locator('[data-testid="day-textarea"]')).toHaveValue('past entry')
})
