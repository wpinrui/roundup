/**
 * E2E pre-launch seeding helpers.
 *
 * The Today + Settings flows expect rubrics.md + dimensions + (optionally) a
 * day row to exist before the user touches anything. We can't go through the
 * wizard on every test (slow + brittle) and we can't open the SQLite file
 * from Node here either — `pree2e` rebuilds better-sqlite3 against Electron's
 * ABI, so importing it from Node would crash. Instead:
 *
 *  1. `seedRubrics()` writes rubrics.md, which is the wizard-bypass signal.
 *  2. `seedAppViaIpc()` runs after the page is loaded and uses the real
 *     `window.api` IPC surface to insert dimensions and optionally a
 *     pre-saved day. This goes through the same code path the UI uses.
 */

import path from 'path'
import { writeFileSync } from 'fs'
import type { Page } from '@playwright/test'

export interface SeedDimension {
  name: string
  weight: number
  successText: string
  constraintsText: string
  antiGoalsText: string
  additionalInfo: string | null
}

/** Write rubrics.md so isSetupComplete() returns true and the wizard is skipped. */
export function seedRubrics(userDataDir: string, dims: SeedDimension[]): void {
  const md = dims
    .map(
      (d) =>
        `## ${d.name}\n\n| Score | Descriptor |\n|---|---|\n| 0 | nothing |\n| 5 | okay |\n| 10 | standout |\n`
    )
    .join('\n')
  writeFileSync(path.join(userDataDir, 'rubrics.md'), md, 'utf8')
}

/**
 * Insert dimensions, an API key, and optionally a pre-saved day via the real
 * IPC surface after the app has launched. Wait for the page to load before
 * calling.
 *
 * After seeding we reload the page so the TodayPane re-fetches `getDay` and
 * `listDays`. Without the reload, the pane keeps the stale empty state from
 * its initial mount (which fired before this seed ran).
 *
 * The seeded API key is mock — the grade handler refuses to run without
 * something stored, and the mock-Anthropic env hook makes the key irrelevant
 * to the actual grading call.
 */
export async function seedAppViaIpc(
  page: Page,
  opts: {
    dimensions: SeedDimension[]
    savedDay?: { date: string; rawEntry: string }
    apiKey?: string
  }
): Promise<void> {
  await page.waitForFunction(
    () => typeof (globalThis as { api?: unknown }).api !== 'undefined',
    null,
    { timeout: 10_000 }
  )
  const apiKey = opts.apiKey ?? 'sk-ant-mock-e2e'
  await page.evaluate(
    async (data) => {
      type Api = {
        saveDimensions: (d: typeof data.dimensions) => Promise<void>
        saveDayText: (date: string, text: string) => Promise<unknown>
        saveApiKey: (k: string) => Promise<void>
      }
      const api = (globalThis as { api: Api }).api
      await api.saveApiKey(data.apiKey)
      await api.saveDimensions(data.dimensions)
      if (data.savedDay) {
        await api.saveDayText(data.savedDay.date, data.savedDay.rawEntry)
      }
    },
    { ...opts, apiKey }
  )
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
}

export function todayDateString(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
