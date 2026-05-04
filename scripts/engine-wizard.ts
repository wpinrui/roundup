/**
 * Wizard engine harness — exercises the same engine modules the UI uses.
 *
 * Reads a JSON spec from stdin:
 *   { "apiKey": "...", "dimensions": [DimensionInput, ...] }
 *
 * Steps (mirroring wizard step 1 → 2 → 3):
 *   1. verifyKey(apiKey)                     — live Anthropic ping
 *   2. saveDimensions(db, dims)              — into a temp on-disk SQLite DB
 *   3. generateAndPersistRubrics(db, key, dir) — writes rubrics.md
 *
 * On success: exit 0, print the path to the temp rubrics.md on stdout.
 * On failure: exit non-zero, print a single-line reason on stderr.
 *
 * The harness operates fully inside an ephemeral `os.tmpdir()`/<random>/
 * workspace, so it never touches the real userData dir and leaves nothing
 * behind in production paths.
 *
 * Run via: tsx scripts/engine-wizard.ts < spec.json
 */

import { mkdtempSync, mkdirSync } from 'fs'
import path from 'path'
import os from 'os'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../src/main/db/schema'
import { verifyKey } from '../src/main/ai/verify'
import { saveDimensions, generateAndPersistRubrics } from '../src/main/wizard'
import type { DimensionInput } from '../src/shared/ipc'

interface Spec {
  apiKey: string
  dimensions: DimensionInput[]
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function fail(message: string): never {
  process.stderr.write(`engine-wizard: ${message}\n`)
  process.exit(1)
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

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'roundup-engine-'))
  mkdirSync(tempDir, { recursive: true })

  // Step 1
  const verify = await verifyKey(spec.apiKey)
  if (!verify.ok) fail(`verify failed: ${verify.error ?? 'unknown'}`)

  // Step 2
  const dbPath = path.join(tempDir, 'engine.sqlite')
  const sqlite = new Database(dbPath)
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  const migrationsFolder = path.resolve(__dirname, '..', 'drizzle')
  migrate(db, { migrationsFolder })
  await saveDimensions(db, spec.dimensions)

  // Step 3
  const markdown = await generateAndPersistRubrics(db, spec.apiKey, tempDir)
  if (!markdown.trim()) fail('rubrics.md was generated empty')

  process.stdout.write(`${path.join(tempDir, 'rubrics.md')}\n`)
  process.exit(0)
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
