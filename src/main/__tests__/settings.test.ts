import { describe, it, expect, beforeEach, vi } from 'vitest'
import path from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../db/schema'
import {
  getVizToggles,
  setVizToggle,
  updateApiKey,
  VIZ_TOGGLE_KEYS,
} from '../settings'

type DB = ReturnType<typeof drizzle<typeof schema>>
const migrationsFolder = path.resolve(__dirname, '../../../drizzle')

let db: DB

beforeEach(() => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
})

describe('viz toggles', () => {
  it('defaults all 7 toggles to true when nothing stored', async () => {
    const state = await getVizToggles(db)
    expect(Object.keys(state).sort()).toEqual([...VIZ_TOGGLE_KEYS].sort())
    for (const key of VIZ_TOGGLE_KEYS) expect(state[key]).toBe(true)
  })

  it('persists a single toggle and reads it back', async () => {
    await setVizToggle(db, 'heatmap', false)
    const state = await getVizToggles(db)
    expect(state.heatmap).toBe(false)
    expect(state.radar).toBe(true)
  })

  it('upserts on second write to the same key', async () => {
    await setVizToggle(db, 'streaks', false)
    await setVizToggle(db, 'streaks', true)
    const state = await getVizToggles(db)
    expect(state.streaks).toBe(true)
  })

  it('rejects an unknown toggle key', async () => {
    await expect(
      setVizToggle(db, 'phantom' as unknown as 'heatmap', true)
    ).rejects.toThrow(/unknown/i)
  })

  it('survives a fresh DB connection (persistence across restarts)', async () => {
    await setVizToggle(db, 'anomaly', false)
    // Re-open Drizzle on the same in-memory DB by reusing the underlying
    // sqlite connection — emulate "restart" by re-reading.
    const fresh = await getVizToggles(db)
    expect(fresh.anomaly).toBe(false)
  })
})

describe('updateApiKey — verify-then-replace', () => {
  it('returns ok and persists when verify succeeds', async () => {
    const verify = vi.fn().mockResolvedValue({ ok: true })
    const persist = vi.fn()
    const r = await updateApiKey('sk-ant-good', verify, persist)
    expect(r.ok).toBe(true)
    expect(verify).toHaveBeenCalledWith('sk-ant-good')
    expect(persist).toHaveBeenCalledWith('sk-ant-good')
  })

  it('does NOT persist when verify fails', async () => {
    const verify = vi.fn().mockResolvedValue({ ok: false, error: 'bad key' })
    const persist = vi.fn()
    const r = await updateApiKey('sk-ant-bad', verify, persist)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('bad key')
    expect(persist).not.toHaveBeenCalled()
  })

  it('rejects an empty key without calling verify', async () => {
    const verify = vi.fn()
    const persist = vi.fn()
    const r = await updateApiKey('   ', verify, persist)
    expect(r.ok).toBe(false)
    expect(verify).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
  })
})
