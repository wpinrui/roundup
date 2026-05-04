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
    weight: 6,
    successText: 'walk daily',
    constraintsText: '',
    antiGoalsText: '',
    additionalInfo: null,
  },
  {
    name: 'Sleep',
    weight: 5,
    successText: 'sleep 7h',
    constraintsText: '',
    antiGoalsText: '',
    additionalInfo: null,
  },
]

let app: ElectronApplication
let userDataDir: string

test.beforeEach(() => {
  userDataDir = mkdtempSync(path.join(os.tmpdir(), 'roundup-history-'))
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

/** Build a list of consecutive past dates ending today, oldest-first. */
function consecutiveDates(count: number): string[] {
  const today = todayDateString()
  const [y, m, d] = today.split('-').map(Number)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const ts = Date.UTC(y, m - 1, d) - i * 86_400_000
    const dt = new Date(ts)
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
        dt.getUTCDate()
      ).padStart(2, '0')}`
    )
  }
  return out
}

test('History — tab navigation renders all enabled viz', async () => {
  const window = await launch()
  const dates = consecutiveDates(7)
  await seedAppViaIpc(window, {
    dimensions: SEED_DIMENSIONS,
    gradedDays: dates.map((d) => ({ date: d, rawEntry: 'a graded day' })),
  })

  await window.getByRole('link', { name: 'History' }).click()
  await expect(window.locator('[data-testid="history-pane"]')).toBeVisible({ timeout: 10_000 })

  // Default tab is past7 — Heatmap, Radar, Ribbon, Gap, Streaks should render.
  await expect(window.locator('[data-testid="chart-heatmap"]').first()).toBeVisible({ timeout: 5_000 })
  await expect(window.locator('[data-testid="chart-radar"]').first()).toBeVisible()
  await expect(window.locator('[data-testid="chart-ribbon"]').first()).toBeVisible()
  await expect(window.locator('[data-testid="chart-gap"]').first()).toBeVisible()
  await expect(window.locator('[data-testid="chart-streaks"]').first()).toBeVisible()

  // Switch to Past 30
  await window.locator('[data-testid="tab-past30"]').click()
  await expect(window.locator('[data-testid="chart-heatmap"]').first()).toBeVisible({ timeout: 5_000 })

  // Switch to Custom — date inputs visible
  await window.locator('[data-testid="tab-custom"]').click()
  await expect(window.locator('[data-testid="custom-start"]')).toBeVisible()
  await expect(window.locator('[data-testid="custom-end"]')).toBeVisible()
  await expect(window.locator('[data-testid="custom-apply"]')).toBeVisible()
})

test('History — clicking a heatmap cell opens the past-day modal; Go to day navigates', async () => {
  const window = await launch()
  const dates = consecutiveDates(7)
  await seedAppViaIpc(window, {
    dimensions: SEED_DIMENSIONS,
    gradedDays: dates.map((d) => ({ date: d, rawEntry: 'a graded day' })),
  })

  await window.getByRole('link', { name: 'History' }).click()
  await expect(window.locator('[data-testid="history-pane"]')).toBeVisible({ timeout: 10_000 })

  // Click an earlier-day heatmap cell.
  const targetDate = dates[2] // not today, not yesterday
  const cell = window.locator(`[data-testid="heatmap-cell"][data-date="${targetDate}"]`).first()
  await expect(cell).toBeVisible({ timeout: 5_000 })
  await cell.click()

  // Modal opens with the graded body.
  await expect(window.locator('[data-testid="modal-graded"]')).toBeVisible({ timeout: 5_000 })

  // Go to day → /day/<targetDate>. The day was graded, so TodayPane lands in
  // readout mode (no textarea); we assert the readout body is visible and that
  // clicking Edit reveals the original text in the textarea.
  await window.locator('[data-testid="modal-go-to-day"]').click()
  await expect(window.locator('[data-testid="day-label"]')).toBeVisible({ timeout: 5_000 })
  await expect(window.locator('[data-testid="day-readout"]')).toBeVisible({ timeout: 5_000 })
  await window.locator('[data-testid="day-edit"]').click()
  await expect(window.locator('[data-testid="day-textarea"]')).toHaveValue('a graded day')
})

test('History — viz toggles in Settings hide charts in History', async () => {
  const window = await launch()
  const dates = consecutiveDates(5)
  await seedAppViaIpc(window, {
    dimensions: SEED_DIMENSIONS,
    gradedDays: dates.map((d) => ({ date: d, rawEntry: 'graded' })),
  })

  // Disable heatmap via Settings.
  await window.getByRole('link', { name: 'Settings' }).click()
  await expect(window.locator('[data-testid="settings-pane"]')).toBeVisible({ timeout: 5_000 })
  const heatmapSwitch = window
    .locator('[data-testid="settings-viz-toggles"] button[role="switch"]')
    .first()
  await expect(heatmapSwitch).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 })
  await heatmapSwitch.click()
  await expect(heatmapSwitch).toHaveAttribute('aria-checked', 'false')

  // Navigate to History — heatmap should be absent, but other viz still render.
  await window.getByRole('link', { name: 'History' }).click()
  await expect(window.locator('[data-testid="history-pane"]')).toBeVisible({ timeout: 10_000 })
  await expect(window.locator('[data-testid="chart-heatmap"]')).toHaveCount(0)
  await expect(window.locator('[data-testid="chart-streaks"]').first()).toBeVisible()
})
