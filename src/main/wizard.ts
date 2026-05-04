/**
 * Wizard handlers — DB writes for step 2 and rubrics fs write for step 3.
 *
 * Functions take all their inputs explicitly (db client, api key, output dir)
 * so the CLI engine harness can call the exact same code path the IPC
 * handlers do, just with a different key source and output dir.
 */

import { writeFileSync } from 'fs'
import type { DimensionInput } from '@shared/ipc'
import type { DrizzleClient } from './db/client'
import { dimensions } from './db/schema'
import { generateRubrics as callSonnet } from './ai/rubrics'
import { rubricsPath } from './setup'

export async function saveDimensions(
  db: DrizzleClient,
  inputs: DimensionInput[]
): Promise<void> {
  if (inputs.length === 0) {
    throw new Error('Cannot save: no dimensions provided.')
  }
  if (inputs.length > 8) {
    throw new Error('Cannot save: maximum 8 dimensions.')
  }
  const now = new Date().toISOString()
  const rows = inputs.map((d) => ({
    name: d.name,
    weight: d.weight,
    successText: d.successText,
    constraintsText: d.constraintsText,
    antiGoalsText: d.antiGoalsText,
    additionalInfo: d.additionalInfo,
    createdAt: now,
  }))
  // better-sqlite3 is synchronous; the async signature is for IPC ergonomics.
  await db.insert(dimensions).values(rows)
}

/**
 * Reads dimensions from `db`, generates rubrics via Sonnet using `apiKey`,
 * writes the result to `<outputDir>/rubrics.md`, and returns the markdown.
 */
export async function generateAndPersistRubrics(
  db: DrizzleClient,
  apiKey: string,
  outputDir: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('No API key provided.')
  }

  const stored = await db.select().from(dimensions)
  if (stored.length === 0) {
    throw new Error('No dimensions stored. Complete step 2 of the wizard first.')
  }

  const inputs: DimensionInput[] = stored.map((d) => ({
    name: d.name,
    weight: d.weight,
    successText: d.successText,
    constraintsText: d.constraintsText,
    antiGoalsText: d.antiGoalsText,
    additionalInfo: d.additionalInfo,
  }))

  const markdown = await callSonnet(apiKey, inputs)
  writeFileSync(rubricsPath(outputDir), markdown, 'utf8')
  return markdown
}
