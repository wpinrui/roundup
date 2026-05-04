import { describe, it, expect, beforeEach, vi } from 'vitest'
import path from 'path'
import { mkdtempSync, writeFileSync } from 'fs'
import os from 'os'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../db/schema'
import { dimensions, scores as scoresTable } from '../db/schema'

const gradeMock = vi.fn()
vi.mock('../ai/grade', () => ({
  gradeDay: (...args: unknown[]) => gradeMock(...args),
}))

const { getDay, listDays, saveDayText, gradeDay } = await import('../day')

type DB = ReturnType<typeof drizzle<typeof schema>>
const migrationsFolder = path.resolve(__dirname, '../../../drizzle')

function freshDb(): DB {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  return db
}

async function seedDimensions(db: DB) {
  await db.insert(dimensions).values([
    {
      name: 'Work',
      weight: 8,
      successText: 'ship features',
      constraintsText: 'no overtime',
      antiGoalsText: 'busywork',
      additionalInfo: null,
      createdAt: '2026-04-01T00:00:00Z',
    },
    {
      name: 'Health',
      weight: 5,
      successText: 'walk daily',
      constraintsText: '',
      antiGoalsText: '',
      additionalInfo: null,
      createdAt: '2026-04-01T00:00:00Z',
    },
  ])
  return db.select().from(dimensions)
}

beforeEach(() => {
  gradeMock.mockReset()
})

describe('getDay', () => {
  it('returns null when the day does not exist', async () => {
    const db = freshDb()
    expect(await getDay(db, '2026-05-04')).toBeNull()
  })

  it('returns a day with empty scores/suggestions when ungraded', async () => {
    const db = freshDb()
    await saveDayText(db, '2026-05-04', 'today I worked')
    const row = await getDay(db, '2026-05-04')
    expect(row).not.toBeNull()
    expect(row!.rawEntry).toBe('today I worked')
    expect(row!.gradedAt).toBeNull()
    expect(row!.scores).toEqual([])
    expect(row!.suggestions).toEqual([])
  })
})

describe('listDays', () => {
  it('returns each day with its gradedAt, ordered ascending', async () => {
    const db = freshDb()
    await saveDayText(db, '2026-05-02', 'a')
    await saveDayText(db, '2026-05-04', 'b')
    await saveDayText(db, '2026-05-03', 'c')
    const rows = await listDays(db)
    expect(rows.map((r) => r.date)).toEqual(['2026-05-02', '2026-05-03', '2026-05-04'])
    for (const r of rows) expect(r.gradedAt).toBeNull()
  })
})

describe('saveDayText', () => {
  it('rejects an invalid date format', async () => {
    const db = freshDb()
    await expect(saveDayText(db, '5/4/2026', 'x')).rejects.toThrow(/YYYY-MM-DD/)
  })

  it('inserts a new day with rawEntry set', async () => {
    const db = freshDb()
    const row = await saveDayText(db, '2026-05-04', 'first save')
    expect(row.rawEntry).toBe('first save')
    expect(row.gradedAt).toBeNull()
  })

  it('updates rawEntry on conflict without touching grade fields', async () => {
    const db = freshDb()
    await saveDayText(db, '2026-05-04', 'v1')
    // Simulate a graded state by setting grade fields directly via Drizzle.
    const { eq } = await import('drizzle-orm')
    await db
      .update(schema.days)
      .set({
        gradedAt: '2026-05-04T18:00:00Z',
        aiNarrative: 'n',
        weightedOverallScore: 7,
      })
      .where(eq(schema.days.date, '2026-05-04'))
    const row = await saveDayText(db, '2026-05-04', 'v2')
    expect(row.rawEntry).toBe('v2')
    expect(row.gradedAt).toBe('2026-05-04T18:00:00Z')
    expect(row.aiNarrative).toBe('n')
    expect(row.weightedOverallScore).toBe(7)
  })
})

describe('gradeDay', () => {
  function setupRubrics(): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'roundup-grade-test-'))
    writeFileSync(path.join(dir, 'rubrics.md'), '## Work\n## Health\n', 'utf8')
    return dir
  }

  it('throws when the day has no saved text', async () => {
    const db = freshDb()
    await seedDimensions(db)
    const dir = setupRubrics()
    await expect(gradeDay(db, 'k', dir, '2026-05-04')).rejects.toThrow(/no day text saved/i)
  })

  it('throws when no dimensions exist', async () => {
    const db = freshDb()
    const dir = setupRubrics()
    await saveDayText(db, '2026-05-04', 'x')
    await expect(gradeDay(db, 'k', dir, '2026-05-04')).rejects.toThrow(/no dimensions/i)
  })

  it('persists narrative + scores + suggestions and returns the joined row', async () => {
    const db = freshDb()
    const dims = await seedDimensions(db)
    const dir = setupRubrics()
    await saveDayText(db, '2026-05-04', 'today text')

    gradeMock.mockResolvedValue({
      narrative: 'A solid day.',
      scores: [
        { dimensionId: dims[0].id, score: 7, hoursEstimated: 4 },
        { dimensionId: dims[1].id, score: 6, hoursEstimated: 1 },
      ],
      weightedOverallScore: (7 * 8 + 6 * 5) / (8 + 5),
      candidateSuggestions: [
        { dimensionId: dims[0].id, text: 'Consider deep work' },
        { dimensionId: dims[1].id, text: 'Try a longer walk' },
      ],
    })

    const row = await gradeDay(db, 'sk-ant-test', dir, '2026-05-04')
    expect(row.aiNarrative).toBe('A solid day.')
    expect(row.gradedAt).not.toBeNull()
    expect(row.weightedOverallScore).toBeCloseTo((7 * 8 + 6 * 5) / 13)
    expect(row.scores).toHaveLength(2)
    expect(row.scores.map((s) => s.dimensionName).sort()).toEqual(['Health', 'Work'])
    expect(row.suggestions.length).toBeGreaterThan(0)
    for (const s of row.suggestions) expect(s.mode).toBe('fix') // < 7 graded days
  })

  it('overwrites previous grade fields and rows on re-grade (decision B1)', async () => {
    const db = freshDb()
    const dims = await seedDimensions(db)
    const dir = setupRubrics()
    await saveDayText(db, '2026-05-04', 'text')

    gradeMock.mockResolvedValueOnce({
      narrative: 'First grade.',
      scores: [
        { dimensionId: dims[0].id, score: 5, hoursEstimated: null },
        { dimensionId: dims[1].id, score: 5, hoursEstimated: null },
      ],
      weightedOverallScore: 5,
      candidateSuggestions: [
        { dimensionId: dims[0].id, text: 'old work' },
        { dimensionId: dims[1].id, text: 'old health' },
      ],
    })
    const first = await gradeDay(db, 'k', dir, '2026-05-04')
    const firstGradedAt = first.gradedAt
    expect(first.aiNarrative).toBe('First grade.')

    // Tiny pause so the second gradedAt timestamp differs.
    await new Promise((r) => setTimeout(r, 10))

    gradeMock.mockResolvedValueOnce({
      narrative: 'Second grade.',
      scores: [
        { dimensionId: dims[0].id, score: 8, hoursEstimated: null },
        { dimensionId: dims[1].id, score: 8, hoursEstimated: null },
      ],
      weightedOverallScore: 8,
      candidateSuggestions: [
        { dimensionId: dims[0].id, text: 'new work' },
        { dimensionId: dims[1].id, text: 'new health' },
      ],
    })
    const second = await gradeDay(db, 'k', dir, '2026-05-04')
    expect(second.aiNarrative).toBe('Second grade.')
    expect(second.gradedAt).not.toBe(firstGradedAt)
    expect(second.weightedOverallScore).toBe(8)
    expect(second.scores.find((s) => s.dimensionName === 'Work')?.score).toBe(8)
    // Old suggestions are gone — every suggestion text is from the second pool.
    for (const s of second.suggestions) expect(s.text).toMatch(/^new /)
    // No row duplication.
    const allScores = await db.select().from(scoresTable)
    expect(allScores).toHaveLength(2)
  })
})
