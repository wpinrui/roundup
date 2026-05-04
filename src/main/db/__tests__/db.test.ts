import { describe, it, expect, beforeEach } from 'vitest'
import path from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { days, dimensions, scores, suggestions } from '../schema'
import * as schema from '../schema'

type DB = ReturnType<typeof drizzle<typeof schema>>

const migrationsFolder = path.resolve(__dirname, '../../../../drizzle')

describe('database schema', () => {
  let db: DB

  beforeEach(() => {
    const sqlite = new Database(':memory:')
    // Mirror production pragmas so tests catch FK violations the same way prod does.
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder })
  })

  it('inserts and reads a day', async () => {
    await db.insert(days).values({
      date: '2026-01-01',
      rawEntry: 'Did some work, went for a run.',
      createdAt: new Date().toISOString(),
    })
    const result = await db.select().from(days)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-01-01')
    expect(result[0].gradedAt).toBeNull()
    expect(result[0].weightedOverallScore).toBeNull()
  })

  it('inserts and reads a dimension', async () => {
    await db.insert(dimensions).values({
      name: 'Health',
      weight: 8,
      successText: 'Exercise 3x/week, sleep 7h',
      constraintsText: 'No gym after 9pm',
      antiGoalsText: 'Overtraining',
      createdAt: new Date().toISOString(),
    })
    const result = await db.select().from(dimensions)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Health')
    expect(result[0].weight).toBe(8)
    expect(result[0].additionalInfo).toBeNull()
  })

  it('inserts and reads a score', async () => {
    await db.insert(days).values({
      date: '2026-01-01',
      rawEntry: 'Test',
      createdAt: new Date().toISOString(),
    })
    const [dim] = await db
      .insert(dimensions)
      .values({
        name: 'Work',
        weight: 9,
        successText: 'Ship features',
        constraintsText: 'No overtime past 7pm',
        antiGoalsText: 'Busywork',
        createdAt: new Date().toISOString(),
      })
      .returning()

    await db.insert(scores).values({
      dayDate: '2026-01-01',
      dimensionId: dim.id,
      score: 7.5,
      hoursEstimated: 3.0,
    })

    const result = await db.select().from(scores)
    expect(result).toHaveLength(1)
    expect(result[0].score).toBe(7.5)
    expect(result[0].hoursEstimated).toBe(3.0)
    expect(result[0].dayDate).toBe('2026-01-01')
  })

  it('inserts and reads a suggestion', async () => {
    await db.insert(days).values({
      date: '2026-01-01',
      rawEntry: 'Test',
      createdAt: new Date().toISOString(),
    })
    const [dim] = await db
      .insert(dimensions)
      .values({
        name: 'Fitness',
        weight: 7,
        successText: 'Active every day',
        constraintsText: 'None',
        antiGoalsText: 'Injury',
        createdAt: new Date().toISOString(),
      })
      .returning()

    await db.insert(suggestions).values({
      dayDate: '2026-01-01',
      dimensionId: dim.id,
      rank: 1,
      text: 'Consider a 20-minute walk before lunch.',
      mode: 'fix',
    })

    const result = await db.select().from(suggestions)
    expect(result).toHaveLength(1)
    expect(result[0].mode).toBe('fix')
    expect(result[0].rank).toBe(1)
  })

  it('rejects suggestion with invalid mode (CHECK constraint)', async () => {
    await db.insert(days).values({
      date: '2026-01-01',
      rawEntry: 'Test',
      createdAt: new Date().toISOString(),
    })
    const [dim] = await db
      .insert(dimensions)
      .values({
        name: 'Fitness',
        weight: 7,
        successText: 'Active',
        constraintsText: '',
        antiGoalsText: '',
        createdAt: new Date().toISOString(),
      })
      .returning()

    await expect(
      db.insert(suggestions).values({
        dayDate: '2026-01-01',
        dimensionId: dim.id,
        rank: 1,
        text: 'Bad mode',
        mode: 'invalid' as 'fix',
      })
    ).rejects.toThrow()
  })

  it('rejects dimension weight outside 1–10 (CHECK constraint)', async () => {
    await expect(
      db.insert(dimensions).values({
        name: 'OOR',
        weight: 11,
        successText: '',
        constraintsText: '',
        antiGoalsText: '',
        createdAt: new Date().toISOString(),
      })
    ).rejects.toThrow()
  })

  it('rejects score outside 0–10 (CHECK constraint)', async () => {
    await db.insert(days).values({
      date: '2026-01-01',
      rawEntry: 'x',
      createdAt: new Date().toISOString(),
    })
    const [dim] = await db
      .insert(dimensions)
      .values({
        name: 'X',
        weight: 5,
        successText: '',
        constraintsText: '',
        antiGoalsText: '',
        createdAt: new Date().toISOString(),
      })
      .returning()

    await expect(
      db.insert(scores).values({
        dayDate: '2026-01-01',
        dimensionId: dim.id,
        score: 11,
      })
    ).rejects.toThrow()
  })

  it('rejects suggestion rank ≤ 0 (CHECK constraint)', async () => {
    await db.insert(days).values({
      date: '2026-01-01',
      rawEntry: 'x',
      createdAt: new Date().toISOString(),
    })
    const [dim] = await db
      .insert(dimensions)
      .values({
        name: 'X',
        weight: 5,
        successText: '',
        constraintsText: '',
        antiGoalsText: '',
        createdAt: new Date().toISOString(),
      })
      .returning()

    await expect(
      db.insert(suggestions).values({
        dayDate: '2026-01-01',
        dimensionId: dim.id,
        rank: 0,
        text: 'bad',
        mode: 'fix',
      })
    ).rejects.toThrow()
  })

  it('rejects score with non-existent day_date (FK constraint)', async () => {
    const [dim] = await db
      .insert(dimensions)
      .values({
        name: 'X',
        weight: 5,
        successText: '',
        constraintsText: '',
        antiGoalsText: '',
        createdAt: new Date().toISOString(),
      })
      .returning()

    await expect(
      db.insert(scores).values({
        dayDate: '2099-01-01', // no such day
        dimensionId: dim.id,
        score: 5,
      })
    ).rejects.toThrow()
  })

  it('rejects score with non-existent dimension_id (FK constraint)', async () => {
    await db.insert(days).values({
      date: '2026-01-01',
      rawEntry: 'x',
      createdAt: new Date().toISOString(),
    })

    await expect(
      db.insert(scores).values({
        dayDate: '2026-01-01',
        dimensionId: 99999, // no such dimension
        score: 5,
      })
    ).rejects.toThrow()
  })
})
