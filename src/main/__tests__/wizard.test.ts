import { describe, it, expect, beforeEach, vi } from 'vitest'
import path from 'path'
import { mkdtempSync, existsSync, readFileSync } from 'fs'
import os from 'os'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../db/schema'
import { dimensions } from '../db/schema'

// Mock the Sonnet call so wizard tests don't hit the network.
const generateMock = vi.fn()
vi.mock('../ai/rubrics', () => ({
  generateRubrics: (...args: unknown[]) => generateMock(...args),
}))

const { saveDimensions, generateAndPersistRubrics } = await import('../wizard')

type DB = ReturnType<typeof drizzle<typeof schema>>
const migrationsFolder = path.resolve(__dirname, '../../../drizzle')

function freshDb(): DB {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  return db
}

const validDim = {
  name: 'Work',
  weight: 8,
  successText: 'Ship features',
  constraintsText: 'Family evenings off-limits',
  antiGoalsText: 'Busywork',
  additionalInfo: null,
}

beforeEach(() => {
  generateMock.mockReset()
})

describe('saveDimensions', () => {
  it('inserts all dimensions in one go', async () => {
    const db = freshDb()
    await saveDimensions(db, [validDim, { ...validDim, name: 'Health', weight: 6 }])
    const rows = await db.select().from(dimensions)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.name).sort()).toEqual(['Health', 'Work'])
  })

  it('rejects an empty list', async () => {
    const db = freshDb()
    await expect(saveDimensions(db, [])).rejects.toThrow(/no dimensions/i)
  })

  it('rejects more than 8 dimensions', async () => {
    const db = freshDb()
    const nine = Array.from({ length: 9 }, (_, i) => ({ ...validDim, name: `D${i}` }))
    await expect(saveDimensions(db, nine)).rejects.toThrow(/maximum 8/i)
  })

  it('lets DB CHECK reject out-of-range weight', async () => {
    const db = freshDb()
    await expect(
      saveDimensions(db, [{ ...validDim, weight: 11 }])
    ).rejects.toThrow()
  })
})

describe('generateAndPersistRubrics', () => {
  it('writes rubrics.md to the output dir and returns the markdown', async () => {
    const db = freshDb()
    await saveDimensions(db, [validDim])
    generateMock.mockResolvedValue('## Work\n\n| Score | Descriptor |\n')

    const dir = mkdtempSync(path.join(os.tmpdir(), 'roundup-wizard-'))
    const md = await generateAndPersistRubrics(db, 'sk-ant-test', dir)

    expect(md).toContain('## Work')
    const written = path.join(dir, 'rubrics.md')
    expect(existsSync(written)).toBe(true)
    expect(readFileSync(written, 'utf8')).toBe(md)
    // Sonnet was called with the saved dimensions
    expect(generateMock).toHaveBeenCalledOnce()
    const [keyArg, dimsArg] = generateMock.mock.calls[0]
    expect(keyArg).toBe('sk-ant-test')
    expect(dimsArg).toHaveLength(1)
    expect(dimsArg[0].name).toBe('Work')
  })

  it('throws when no API key is provided', async () => {
    const db = freshDb()
    await saveDimensions(db, [validDim])
    const dir = mkdtempSync(path.join(os.tmpdir(), 'roundup-wizard-'))
    await expect(generateAndPersistRubrics(db, '', dir)).rejects.toThrow(/no api key/i)
  })

  it('throws when no dimensions are stored', async () => {
    const db = freshDb()
    const dir = mkdtempSync(path.join(os.tmpdir(), 'roundup-wizard-'))
    await expect(generateAndPersistRubrics(db, 'k', dir)).rejects.toThrow(/no dimensions/i)
  })
})
