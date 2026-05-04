/**
 * Grading engine harness — exercises the same engine modules the UI uses.
 *
 * Reads a JSON spec from stdin:
 *   {
 *     "apiKey": "sk-ant-...",
 *     "dimensions": [DimensionInput, ...],     // ≥ 1, ≤ 8
 *     "rubrics": "## Work\n...",                // contents of rubrics.md
 *     "dayText": "Today I worked..."            // raw entry
 *   }
 *
 * Steps:
 *   1. Stand up an ephemeral on-disk SQLite DB and write the spec rubrics
 *      into a temp userData directory.
 *   2. Insert the dimensions, save the day text under today's date, then run
 *      the same `gradeDay()` call the UI invokes via IPC.
 *
 * On success: exit 0, print the resulting `DayRow` JSON on stdout.
 * On failure: exit non-zero, print a single-line reason on stderr.
 *
 * Honours `ROUNDUP_E2E_MOCK_ANTHROPIC=1` so Tricia can run without an API key.
 *
 * Run via: tsx scripts/engine-grade.ts < spec.json
 */

import { mkdtempSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../src/main/db/schema'
import { saveDimensions } from '../src/main/wizard'
import { saveDayText, gradeDay } from '../src/main/day'
import type { DimensionInput } from '../src/shared/ipc'

interface Spec {
  apiKey: string
  dimensions: DimensionInput[]
  rubrics: string
  dayText: string
  /** Optional override; defaults to today in local time, YYYY-MM-DD. */
  date?: string
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function fail(message: string): never {
  process.stderr.write(`engine-grade: ${message}\n`)
  process.exit(1)
}

function todayDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function main(): Promise<void> {
  const raw = (await readStdin()).trim()
  if (!raw) fail('no JSON spec on stdin')

  let spec: Spec
  try {
    spec = JSON.parse(raw) as Spec
  } catch (err) {
    fail(`invalid JSON on stdin: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!spec.apiKey) fail('spec.apiKey is required')
  if (!Array.isArray(spec.dimensions) || spec.dimensions.length === 0) {
    fail('spec.dimensions must be a non-empty array')
  }
  if (typeof spec.rubrics !== 'string' || spec.rubrics.trim().length === 0) {
    fail('spec.rubrics must be a non-empty string')
  }
  if (typeof spec.dayText !== 'string' || spec.dayText.trim().length === 0) {
    fail('spec.dayText must be a non-empty string')
  }

  const date = spec.date ?? todayDate()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail(`spec.date must be YYYY-MM-DD, got "${date}"`)
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'roundup-engine-grade-'))
  writeFileSync(path.join(tempDir, 'rubrics.md'), spec.rubrics, 'utf8')

  const sqlite = new Database(path.join(tempDir, 'engine.sqlite'))
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  const migrationsFolder = path.resolve(__dirname, '..', 'drizzle')
  migrate(db, { migrationsFolder })

  await saveDimensions(db, spec.dimensions)
  await saveDayText(db, date, spec.dayText)

  const row = await gradeDay(db, spec.apiKey, tempDir, date)
  process.stdout.write(`${JSON.stringify(row, null, 2)}\n`)
  process.exit(0)
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
