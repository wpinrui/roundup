import { describe, it, expect, beforeEach } from 'vitest'
import path from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../db/schema'
import { dimensions, days, scores } from '../db/schema'
import { listDimensions, updateDimensions } from '../dimensions'
import type { DimensionUpdate } from '@shared/ipc'

type DB = ReturnType<typeof drizzle<typeof schema>>
const migrationsFolder = path.resolve(__dirname, '../../../drizzle')

let db: DB

beforeEach(() => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
})

const baseInput: Omit<DimensionUpdate, 'id' | 'name' | 'weight'> = {
  successText: 's',
  constraintsText: 'c',
  antiGoalsText: 'a',
  additionalInfo: null,
}

async function seed() {
  await db.insert(dimensions).values([
    {
      name: 'Work',
      weight: 8,
      successText: 's',
      constraintsText: 'c',
      antiGoalsText: 'a',
      additionalInfo: null,
      createdAt: '2026-04-01',
    },
    {
      name: 'Health',
      weight: 5,
      successText: 's',
      constraintsText: 'c',
      antiGoalsText: 'a',
      additionalInfo: null,
      createdAt: '2026-04-01',
    },
  ])
  return listDimensions(db)
}

describe('listDimensions', () => {
  it('returns rows ordered by id', async () => {
    await seed()
    const rows = await listDimensions(db)
    expect(rows.map((r) => r.name)).toEqual(['Work', 'Health'])
  })
})

describe('updateDimensions — bound enforcement', () => {
  it('rejects empty input', async () => {
    await expect(updateDimensions(db, [])).rejects.toThrow(/at least one/i)
  })

  it('rejects more than 8 dimensions', async () => {
    const nine: DimensionUpdate[] = Array.from({ length: 9 }, (_, i) => ({
      ...baseInput,
      id: null,
      name: `D${i}`,
      weight: 5,
    }))
    await expect(updateDimensions(db, nine)).rejects.toThrow(/maximum 8/i)
  })

  it('rejects entries with empty name', async () => {
    await expect(
      updateDimensions(db, [{ ...baseInput, id: null, name: '   ', weight: 5 }])
    ).rejects.toThrow(/name/i)
  })

  it('lets DB CHECK reject out-of-range weight', async () => {
    await expect(
      updateDimensions(db, [{ ...baseInput, id: null, name: 'X', weight: 11 }])
    ).rejects.toThrow()
  })
})

describe('updateDimensions — diff semantics', () => {
  it('inserts new rows when id is null', async () => {
    const rows = await updateDimensions(db, [
      { ...baseInput, id: null, name: 'Sleep', weight: 7 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Sleep')
    expect(rows[0].id).toBeGreaterThan(0)
    expect(rows[0].createdAt).toBeTruthy()
  })

  it('updates an existing row when id is provided', async () => {
    const seeded = await seed()
    const target = seeded.find((d) => d.name === 'Work')!
    const after = await updateDimensions(db, [
      { ...baseInput, id: target.id, name: 'Deep Work', weight: 10 },
      { ...baseInput, id: seeded.find((d) => d.name === 'Health')!.id, name: 'Health', weight: 5 },
    ])
    const updated = after.find((d) => d.id === target.id)!
    expect(updated.name).toBe('Deep Work')
    expect(updated.weight).toBe(10)
    expect(after).toHaveLength(2)
  })

  it('deletes rows that are not in the payload (when no scores reference them)', async () => {
    const seeded = await seed()
    const work = seeded.find((d) => d.name === 'Work')!
    const after = await updateDimensions(db, [
      { ...baseInput, id: work.id, name: 'Work', weight: 8 },
    ])
    expect(after).toHaveLength(1)
    expect(after[0].name).toBe('Work')
  })

  it('refuses to delete a dimension that has scores referencing it', async () => {
    const seeded = await seed()
    const health = seeded.find((d) => d.name === 'Health')!
    await db.insert(days).values({
      date: '2026-05-01',
      rawEntry: 'x',
      createdAt: '2026-05-01T00:00:00Z',
    })
    await db.insert(scores).values({
      dayDate: '2026-05-01',
      dimensionId: health.id,
      score: 6,
      hoursEstimated: null,
    })
    const work = seeded.find((d) => d.name === 'Work')!
    await expect(
      updateDimensions(db, [{ ...baseInput, id: work.id, name: 'Work', weight: 8 }])
    ).rejects.toThrow(/graded days/i)
  })

  it('rejects an update id that does not exist', async () => {
    await expect(
      updateDimensions(db, [{ ...baseInput, id: 99999, name: 'Ghost', weight: 5 }])
    ).rejects.toThrow(/no such row/i)
  })
})
