/**
 * Settings-side dimension update.
 *
 * Diff-against-current semantics: payload entries with `id` UPDATE the row;
 * entries with `id: null` are INSERTed; existing rows missing from the payload
 * are DELETEd. The DB CHECK on weight (1–10) and FK constraints (scores /
 * suggestions referencing dimensions) are the canonical guards — the FK is
 * what protects historical grades from being orphaned by an over-eager delete.
 */

import { eq, asc, inArray } from 'drizzle-orm'
import type { DimensionRow, DimensionUpdate } from '@shared/ipc'
import { DIMENSION_COUNT_MIN, DIMENSION_COUNT_MAX } from '@shared/ipc'
import type { DrizzleClient } from './db/client'
import { dimensions } from './db/schema'

export async function listDimensions(db: DrizzleClient): Promise<DimensionRow[]> {
  const rows = await db.select().from(dimensions).orderBy(asc(dimensions.id))
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    weight: d.weight,
    successText: d.successText,
    constraintsText: d.constraintsText,
    antiGoalsText: d.antiGoalsText,
    additionalInfo: d.additionalInfo,
    createdAt: d.createdAt,
  }))
}

export async function updateDimensions(
  db: DrizzleClient,
  inputs: DimensionUpdate[]
): Promise<DimensionRow[]> {
  if (inputs.length < DIMENSION_COUNT_MIN) {
    throw new Error('At least one dimension is required.')
  }
  if (inputs.length > DIMENSION_COUNT_MAX) {
    throw new Error(`Maximum ${DIMENSION_COUNT_MAX} dimensions allowed.`)
  }
  for (const i of inputs) {
    if (!i.name || !i.name.trim()) {
      throw new Error('Every dimension needs a name.')
    }
  }

  const existing = await db.select({ id: dimensions.id }).from(dimensions)
  const existingIds = new Set(existing.map((r) => r.id))

  const keepIds = new Set<number>()
  for (const i of inputs) {
    if (i.id !== null) {
      if (!existingIds.has(i.id)) {
        throw new Error(`Cannot update dimension id=${i.id}: no such row.`)
      }
      keepIds.add(i.id)
    }
  }

  const deleteIds = [...existingIds].filter((id) => !keepIds.has(id))

  if (deleteIds.length > 0) {
    try {
      await db.delete(dimensions).where(inArray(dimensions.id, deleteIds))
    } catch (err) {
      throw new Error(
        `Cannot delete a dimension that has graded days. Remove or re-grade the affected days first. (${
          err instanceof Error ? err.message : String(err)
        })`
      )
    }
  }

  for (const i of inputs) {
    if (i.id !== null) {
      await db
        .update(dimensions)
        .set({
          name: i.name,
          weight: i.weight,
          successText: i.successText,
          constraintsText: i.constraintsText,
          antiGoalsText: i.antiGoalsText,
          additionalInfo: i.additionalInfo,
        })
        .where(eq(dimensions.id, i.id))
    }
  }

  const inserts = inputs.filter((i) => i.id === null)
  if (inserts.length > 0) {
    const now = new Date().toISOString()
    await db.insert(dimensions).values(
      inserts.map((i) => ({
        name: i.name,
        weight: i.weight,
        successText: i.successText,
        constraintsText: i.constraintsText,
        antiGoalsText: i.antiGoalsText,
        additionalInfo: i.additionalInfo,
        createdAt: now,
      }))
    )
  }

  return listDimensions(db)
}
